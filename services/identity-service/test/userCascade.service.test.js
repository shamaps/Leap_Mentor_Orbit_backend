const crypto = require("node:crypto");
const Redis = require("ioredis");
const config = require("@leapmentor/shared/config/env");
const streams = require("@leapmentor/shared/utils/streams");
const createUserCascadeService = require("../src/services/userCascade.service");

const { CASCADE_STREAM } = createUserCascadeService;
const USER = "a".repeat(24);
const quiet = { info() { }, warn() { }, error() { }, debug() { } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const makeClients = (failing = {}) => {
    const calls = [];
    const client = (name) => {
        const make = (method) => async (path, opts) => {
            calls.push({ service: name, method, path, key: opts?.idempotencyKey });
            if (failing[name]) throw new Error(`${name} is down`);
            return { data: { ok: true, service: name } };
        };
        return { delete: make("DELETE"), post: make("POST") };
    };
    return { calls, clients: { catalog: client("catalog"), engagement: client("engagement"), payments: client("payments") } };
};

// publish fake that records messages instead of touching Redis
const build = ({ failing, publishFails = false } = {}) => {
    const published = [];
    const publish = async (stream, type, payload, opts) => {
        if (publishFails) throw new Error("redis is down");
        published.push({ stream, type, payload, key: opts?.key });
        return "1-0";
    };
    const { calls, clients } = makeClients(failing);
    let n = 0;
    const svc = createUserCascadeService({ publish, clients, logger: quiet, newOperationId: () => `op${++n}` });
    return { svc, published, calls };
};

// ── publishing (Redis up) ─────────────────────────────────────
test("hardDelete publishes one message per service and calls nobody directly", async () => {
    const { svc, published, calls } = build();
    const out = await svc.hardDelete(USER);
    expect([...out.queued].sort()).toEqual(["catalog.hardDelete", "engagement.hardDelete", "payments.hardDelete"]);
    expect(calls).toHaveLength(0); // the worker makes the calls, not the request
    expect(published.every((m) => m.stream === CASCADE_STREAM)).toBe(true);
    expect(published.map((m) => m.type).sort()).toEqual(["catalog.hardDelete", "engagement.hardDelete", "payments.hardDelete"]);
    expect(published.every((m) => m.payload.userId === USER && m.key.startsWith("op1:"))).toBe(true); // stable key per call
});

test("softDelete publishes the soft-delete action for all three services", async () => {
    const { svc, published } = build();
    await svc.softDelete(USER);
    expect(published.map((m) => m.type).sort()).toEqual(
        ["catalog.softDelete", "engagement.softDelete", "payments.softDelete"]);
});

test("restore reaches catalog and payments but never engagement", async () => {
    const { svc, published } = build();
    await svc.restore(USER);
    expect(published.map((m) => m.type).sort()).toEqual(["catalog.restore", "payments.restore"]);
});

test("each operation gets its own keys, so a later soft-delete is not mistaken for an earlier one", async () => {
    const { svc, published } = build();
    await svc.softDelete(USER);
    await svc.restore(USER);
    await svc.softDelete(USER);
    const softKeys = published.filter((m) => m.type === "catalog.softDelete").map((m) => m.key);
    expect(softKeys).toHaveLength(2);
    expect(softKeys[0]).not.toBe(softKeys[1]);
});

// ── Redis down: direct fallback ───────────────────────────────
test("if Redis is down the services are called directly and the result is complete", async () => {
    const { svc, calls } = build({ publishFails: true });
    const out = await svc.hardDelete(USER);
    expect(out.completed).toHaveLength(3);
    expect(out.pending).toEqual([]);
    expect(calls.map((c) => `${c.service} ${c.method} ${c.path}`).sort()).toEqual([
        `catalog DELETE /internal/users/${USER}`,
        `engagement DELETE /internal/users/${USER}`,
        `payments DELETE /internal/users/${USER}`,
    ]);
});

test("Redis down and one service down: the others still run and the failure is reported", async () => {
    const { svc, calls } = build({ publishFails: true, failing: { engagement: true } });
    const out = await svc.hardDelete(USER);
    expect(out.failed).toEqual(["engagement.hardDelete"]);
    expect([...out.completed].sort()).toEqual(["catalog.hardDelete", "payments.hardDelete"]);
    expect(out.pending).toEqual(["engagement.hardDelete"]);
    expect(calls).toHaveLength(3); // all three were attempted
});

// ── worker handlers ───────────────────────────────────────────
test("handlers call the right service route and pass the stable idempotency key", async () => {
    const { svc, calls } = build();
    await svc.handlers["payments.softDelete"]({ userId: USER }, { key: "op1:payments.softDelete", id: "1-0" });
    expect(calls).toEqual([{
        service: "payments", method: "POST", path: `/internal/users/${USER}/soft-delete`, key: "op1:payments.softDelete",
    }]);
});

test("a handler throws when the service fails, so the worker retries it", async () => {
    const { svc } = build({ failing: { catalog: true } });
    await expect(svc.handlers["catalog.hardDelete"]({ userId: USER }, { key: "k" })).rejects.toThrow(/catalog is down/);
});

test("there is a handler for every action in every plan", () => {
    const { svc } = build();
    for (const actions of Object.values(createUserCascadeService.PLANS)) {
        for (const action of actions) expect(typeof svc.handlers[action]).toBe("function");
    }
});

// ── end to end on a real Redis (skipped when none is reachable) ──
const probe = new Redis({
    host: config.redisHost, port: config.redisPort, password: config.redisPassword,
    db: config.streamsRedisDb, lazyConnect: true, retryStrategy: () => null, maxRetriesPerRequest: 0
});
probe.on("error", () => { });
let redisUp = false;

beforeAll(async () => {
    try { await probe.connect(); await probe.ping(); redisUp = true; } catch { redisUp = false; }
});
afterAll(async () => {
    probe.disconnect();
    await streams.closeProducer();
});

// Jest cannot skip a test at run time, so when Redis is unreachable the body returns early.
const e2e = (name, fn) => test(name, async () => {
    if (!redisUp) {
        console.warn(`[skipped] ${name}: no Redis reachable`);
        return;
    }
    const stream = `test:cascade:${crypto.randomBytes(4).toString("hex")}`;
    const workers = [];
    try {
        await fn({
            stream,
            makeWorker: (handlers) => {
                const w = streams.createWorker({ stream, group: "g", handlers, log: quiet, claimIdleMs: 50 });
                workers.push(w);
                return w;
            },
        });
    } finally {
        for (const w of workers) await w.stop().catch(() => { });
        await probe.del(stream, `${stream}:dlq`);
        const keys = await probe.keys(`streams:done:${stream}:*`);
        if (keys.length) await probe.del(...keys);
    }
});

e2e("end to end: hardDelete is carried out by the worker through Redis", async ({ stream, makeWorker }) => {
    const { calls, clients } = makeClients();
    // publish to the test stream instead of the real one
    const publish = (_s, type, payload, opts) => streams.publish(stream, type, payload, opts);
    const svc = createUserCascadeService({ publish, clients, logger: quiet, newOperationId: () => "op1" });
    const worker = makeWorker(svc.handlers);
    await worker.ensureGroup();

    const out = await svc.hardDelete(USER);
    expect(out.queued).toHaveLength(3);
    await worker.processNew();

    expect(calls.map((c) => c.service).sort()).toEqual(["catalog", "engagement", "payments"]);
    expect(await streams.getStreamStats(probe, stream, "g")).toEqual({ length: 3, pending: 0, deadLetters: 0 });
});

e2e("end to end: a service that is down is retried until it comes back, others are unaffected", async ({ stream, makeWorker }) => {
    let engagementUp = false;
    const calls = [];
    const clients = {
        catalog: { delete: async () => { calls.push("catalog"); return {}; } },
        payments: { delete: async () => { calls.push("payments"); return {}; } },
        engagement: { delete: async () => { calls.push("engagement"); if (!engagementUp) throw new Error("engagement is down"); return {}; } },
    };
    const publish = (_s, type, payload, opts) => streams.publish(stream, type, payload, opts);
    const svc = createUserCascadeService({ publish, clients, logger: quiet, newOperationId: () => "op1" });
    const worker = makeWorker(svc.handlers);
    await worker.ensureGroup();

    await svc.hardDelete(USER);
    await worker.processNew();
    // only the engagement call is still owed
    expect((await streams.getStreamStats(probe, stream, "g")).pending).toBe(1);

    engagementUp = true;
    await sleep(80);
    await worker.reclaim();
    expect((await streams.getStreamStats(probe, stream, "g")).pending).toBe(0);
    expect(calls.filter((c) => c === "engagement")).toHaveLength(2); // engagement was retried
    expect(calls.filter((c) => c === "catalog")).toHaveLength(1);    // catalog was not repeated
});