// Runs against a real Redis (default 127.0.0.1:6379, override with REDIS_HOST / REDIS_PORT).
// The Redis-backed tests return early (reported as passed) when no Redis is reachable.
const crypto = require("node:crypto");
const Redis = require("ioredis");
const config = require("@leapmentor/shared/config/env");
const { publish, createWorker, getStreamStats, closeProducer } = require("@leapmentor/shared/utils/streams");
const { createEmailQueue } = require("@leapmentor/shared/utils/emailQueue");
const { buildHandlers } = require("../src/workers/emailWorker");

const quiet = { info() { }, warn() { }, error() { }, debug() { } };
const uid = () => crypto.randomBytes(4).toString("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    await closeProducer();
});

// Jest cannot skip a test at run time, so when Redis is unreachable the body returns early.
const withRedis = (name, fn) => test(name, async () => {
    if (!redisUp) {
        console.warn(`[skipped] ${name}: no Redis reachable`);
        return;
    }
    const stream = `test:${uid()}`;
    const workers = [];
    const make = (opts) => {
        const w = createWorker({ stream, group: "g", log: quiet, claimIdleMs: 50, backoffFactor: 1, ...opts });
        workers.push(w);
        return w;
    };
    try {
        await fn({ stream, make });
    } finally {
        for (const w of workers) await w.stop().catch(() => { });
        await probe.del(stream, `${stream}:dlq`);
        const keys = await probe.keys(`streams:done:${stream}:*`);
        if (keys.length) await probe.del(...keys);
    }
});

// ── Worker behaviour ──────────────────────────────────────────
withRedis("a published message is handled and acknowledged", async ({ stream, make }) => {
    const seen = [];
    const worker = make({ handlers: { hello: async (data) => seen.push(data) } });
    await worker.ensureGroup();
    await publish(stream, "hello", { name: "Asha" });
    await worker.processNew();
    expect(seen).toEqual([{ name: "Asha" }]);
    expect(await getStreamStats(probe, stream, "g")).toEqual({ length: 1, pending: 0, deadLetters: 0 });
});

withRedis("messages published before the worker started are not lost", async ({ stream, make }) => {
    await publish(stream, "hello", { n: 1 });
    await publish(stream, "hello", { n: 2 });
    const seen = [];
    const worker = make({ handlers: { hello: async (d) => seen.push(d.n) } });
    await worker.ensureGroup();
    await worker.processNew();
    expect(seen).toEqual([1, 2]);
});

withRedis("a failed job stays pending and succeeds on retry", async ({ stream, make }) => {
    let calls = 0;
    const worker = make({ handlers: { flaky: async () => { calls += 1; if (calls === 1) throw new Error("smtp down"); } } });
    await worker.ensureGroup();
    await publish(stream, "flaky", {});
    await worker.processNew();
    // the failed job is still owed
    expect((await getStreamStats(probe, stream, "g")).pending).toBe(1);
    await sleep(80);
    await worker.reclaim();
    expect(calls).toBe(2);
    expect((await getStreamStats(probe, stream, "g")).pending).toBe(0);
});

withRedis("a job abandoned by a crashed worker is picked up by another worker", async ({ stream, make }) => {
    const crashing = make({ consumer: "A", handlers: { job: async () => { throw new Error("process died"); } } });
    await crashing.ensureGroup();
    await publish(stream, "job", { id: 7 });
    await crashing.processNew();

    const done = [];
    const rescuer = make({ consumer: "B", handlers: { job: async (d) => done.push(d.id) } });
    await sleep(80);
    await rescuer.reclaim();
    expect(done).toEqual([7]);
    expect((await getStreamStats(probe, stream, "g")).pending).toBe(0);
});

withRedis("a job that keeps failing goes to the dead-letter stream after maxAttempts", async ({ stream, make }) => {
    const worker = make({ maxAttempts: 3, handlers: { bad: async () => { throw new Error("always fails"); } } });
    await worker.ensureGroup();
    await publish(stream, "bad", { x: 1 });
    await worker.processNew();            // delivery 1
    for (let i = 0; i < 4; i += 1) { await sleep(70); await worker.reclaim(); }
    const stats = await getStreamStats(probe, stream, "g");
    expect(stats.pending).toBe(0);
    expect(stats.deadLetters).toBe(1);
    const [[, fields]] = await probe.xrange(`${stream}:dlq`, "-", "+");
    const dlq = {};
    for (let i = 0; i < fields.length; i += 2) dlq[fields[i]] = fields[i + 1];
    expect(dlq.type).toBe("bad");
    expect(dlq.error).toMatch(/always fails/);
});

withRedis("an unknown message type is dead-lettered immediately", async ({ stream, make }) => {
    const worker = make({ handlers: {} });
    await worker.ensureGroup();
    await publish(stream, "nope", {});
    await worker.processNew();
    expect(await getStreamStats(probe, stream, "g")).toEqual({ length: 1, pending: 0, deadLetters: 1 });
});

withRedis("an unparsable payload is dead-lettered instead of retried forever", async ({ stream, make }) => {
    const worker = make({ handlers: { hello: async () => { } } });
    await worker.ensureGroup();
    await probe.xadd(stream, "*", "type", "hello", "payload", "{not json", "key", "");
    await worker.processNew();
    expect((await getStreamStats(probe, stream, "g")).deadLetters).toBe(1);
});

withRedis("a message with the same key is only handled once", async ({ stream, make }) => {
    let calls = 0;
    const worker = make({ handlers: { once: async () => { calls += 1; } } });
    await worker.ensureGroup();
    await publish(stream, "once", {}, { key: "k1" });
    await worker.processNew();
    await publish(stream, "once", {}, { key: "k1" });
    await worker.processNew();
    expect(calls).toBe(1);
    expect((await getStreamStats(probe, stream, "g")).pending).toBe(0);
});

withRedis("start() processes messages in the background and stop() shuts down cleanly", async ({ stream, make }) => {
    const seen = [];
    const worker = make({ blockMs: 200, handlers: { hello: async (d) => seen.push(d.n) } });
    worker.start();
    await publish(stream, "hello", { n: 1 });
    await publish(stream, "hello", { n: 2 });
    for (let i = 0; i < 40 && seen.length < 2; i += 1) await sleep(50);
    expect(seen).toEqual([1, 2]);
    await worker.stop();
});

// ── Email queue (no Redis needed) ─────────────────────────────
const fakeEmails = () => {
    const sent = [];
    return { sent, emails: { sendHello: async (p) => { sent.push(p); return "sent"; }, notAFunction: 5 } };
};

test("queued emails are published instead of sent", async () => {
    const { sent, emails } = fakeEmails();
    const published = [];
    const queue = createEmailQueue({ publish: async (...a) => published.push(a), emails, log: quiet });
    const res = await queue.sendHello({ to: "a@b.c" });
    expect(res).toEqual({ queued: true });
    expect(published).toHaveLength(1);
    const [stream, type, payload, opts] = published[0];
    expect([stream, type, payload]).toEqual(["stream:email", "sendHello", { to: "a@b.c" }]);
    expect(opts.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent).toHaveLength(0);
    expect(queue.EMAIL_TYPES).toEqual(["sendHello"]);
});

test("if Redis is unavailable the email is sent directly", async () => {
    const { sent, emails } = fakeEmails();
    const queue = createEmailQueue({ publish: async () => { throw new Error("ECONNREFUSED"); }, emails, log: quiet });
    expect(await queue.sendHello({ to: "a@b.c" })).toBe("sent");
    expect(sent).toEqual([{ to: "a@b.c" }]);
});

test("with the queue switched off the email is sent directly and Redis is never touched", async () => {
    const { sent, emails } = fakeEmails();
    let touched = false;
    const queue = createEmailQueue({ publish: async () => { touched = true; }, emails, enabled: false, log: quiet });
    await queue.sendHello({ to: "x" });
    expect(touched).toBe(false);
    expect(sent).toHaveLength(1);
});

test("the email worker only exposes functions from the template barrel", async () => {
    const { sent, emails } = fakeEmails();
    const handlers = buildHandlers(emails);
    expect(Object.keys(handlers)).toEqual(["sendHello"]);
    await handlers.sendHello({ to: "z" });
    expect(sent).toEqual([{ to: "z" }]);
});

test("config exposes the stream and email flags", () => {
    expect(typeof config.emailWorkerEnabled).toBe("boolean");
    expect(typeof config.emailQueueEnabled).toBe("boolean");
    expect(Number.isInteger(config.streamsRedisDb)).toBe(true);
});

withRedis("end to end: queued email is sent by the worker, and a send failure is retried", async ({ stream, make }) => {
    let attempts = 0;
    const delivered = [];
    const emails = { sendHello: async (p) => { attempts += 1; if (attempts === 1) throw new Error("smtp timeout"); delivered.push(p); } };
    const queue = createEmailQueue({ publish: (_s, type, payload) => publish(stream, type, payload), emails, log: quiet });
    const worker = make({ handlers: buildHandlers(emails) });
    await worker.ensureGroup();
    await queue.sendHello({ to: "mentor@x.com" });
    await worker.processNew();
    expect(delivered).toEqual([]);
    await sleep(80);
    await worker.reclaim();
    expect(delivered).toEqual([{ to: "mentor@x.com" }]);
});

withRedis("a permanent 4xx failure is dead-lettered immediately, a 429 is retried", async ({ stream, make }) => {
    const worker = make({
        handlers: {
            gone: async () => { throw Object.assign(new Error("not found"), { status: 404 }); },
            busy: async () => { throw Object.assign(new Error("slow down"), { status: 429 }); },
        },
    });
    await worker.ensureGroup();
    await publish(stream, "gone", {});
    await publish(stream, "busy", {});
    await worker.processNew();
    const stats = await getStreamStats(probe, stream, "g");
    expect(stats.deadLetters).toBe(1); // 404 goes straight to the DLQ
    expect(stats.pending).toBe(1);     // 429 stays pending for retry
});

withRedis("trimAcked removes finished messages but never a pending one", async ({ stream, make }) => {
    const worker = make({
        handlers: { job: async (d) => { if (d.n === 2) throw new Error("fails"); } },
    });
    await worker.ensureGroup();
    for (const n of [1, 2, 3]) await publish(stream, "job", { n });
    await worker.processNew();                      // 1 acked, 2 pending, 3 acked
    await worker.trimAcked();
    const stats = await getStreamStats(probe, stream, "g");
    expect(stats.length).toBe(2); // only the acked message older than the pending one is removed
    expect(stats.pending).toBe(1);
});