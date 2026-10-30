/**
 * @fileoverview End-to-end tests of the notification pipeline on a real Redis:
 * publisher -> stream -> worker -> repository -> socket push.
 *
 * Runs against the same Redis as streams.test.js (default 127.0.0.1:6379, override with
 * REDIS_HOST / REDIS_PORT). The tests return early (and show as passed) when no Redis is reachable.
 * The repository is an in-memory stand-in that behaves like the unique eventId index.
 */

const crypto = require("node:crypto");
const Redis = require("ioredis");
const config = require("@leapmentor/shared/config/env");
const { publish, createWorker, getStreamStats, closeProducer } = require("@leapmentor/shared/utils/streams");
const { createNotificationPublisher, NOTIFICATION_EVENT } = require("@leapmentor/shared/utils/notificationQueue");
const { buildHandlers } = require("../../../src/workers/notificationWorker");

const quiet = { info() { }, warn() { }, error() { }, debug() { } };
const uid = () => crypto.randomBytes(4).toString("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const RECIPIENT = "a".repeat(24);
const REQUEST_ID = "b".repeat(24);

const probe = new Redis({
    host: config.redisHost, port: config.redisPort, password: config.redisPassword,
    db: config.streamsRedisDb, lazyConnect: true, retryStrategy: () => null, maxRetriesPerRequest: 0,
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

// In-memory repository that rejects a repeated eventId with a duplicate-key error, like the real index.
const makeRepo = ({ failFirst = 0 } = {}) => {
    const rows = new Map();
    const state = { calls: 0 };
    return {
        rows,
        state,
        createNotification: async (event) => {
            state.calls += 1;
            if (state.calls <= failFirst) throw new Error("mongo down");
            if (rows.has(event.eventId)) throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
            const doc = { ...event, _id: String(rows.size + 1) };
            rows.set(event.eventId, doc);
            return doc;
        },
    };
};

// Jest cannot skip a test at run time, so when Redis is unreachable the body returns early.
const withRedis = (name, fn) => test(name, async () => {
    if (!redisUp) {
        console.warn(`[skipped] ${name}: no Redis reachable`);
        return;
    }
    const stream = `test:notif:${uid()}`;
    const workers = [];
    const setup = ({ repo, emits = [] }) => {
        const emitToUser = (userId, event, data) => { emits.push({ userId, event, data }); };
        const worker = createWorker({
            stream, group: "g", log: quiet, claimIdleMs: 50, backoffFactor: 1,
            handlers: buildHandlers({ repo, getEmitToUser: () => emitToUser, log: quiet }),
        });
        workers.push(worker);
        // publishes to this test's stream instead of the real one
        const publishNotification = createNotificationPublisher({
            publish: (_s, type, payload, opts) => publish(stream, type, payload, opts),
            log: quiet,
        });
        return { worker, publishNotification, emits };
    };
    try {
        await fn({ stream, setup });
    } finally {
        for (const w of workers) await w.stop().catch(() => { });
        await probe.del(stream, `${stream}:dlq`);
        const keys = await probe.keys(`streams:done:${stream}:*`);
        if (keys.length) await probe.del(...keys);
    }
});

const event = (over = {}) => ({
    recipient: RECIPIENT,
    type: "connect_request_received",
    title: "New Connect Request",
    message: "You have a new connect request from a mentee",
    metadata: { requestId: REQUEST_ID },
    dedupeKey: REQUEST_ID,
    ...over,
});

withRedis("a published notification is saved once and pushed to the recipient", async ({ stream, setup }) => {
    const repo = makeRepo();
    const { worker, publishNotification, emits } = setup({ repo });
    await worker.ensureGroup();

    const queued = await publishNotification(event());
    await worker.processNew();

    expect(queued.queued).toBe(true);
    expect(repo.rows.size).toBe(1);
    expect(repo.rows.get(queued.eventId)).toMatchObject({ recipient: RECIPIENT, type: "connect_request_received", metadata: { requestId: REQUEST_ID } });
    expect(emits).toHaveLength(1);
    expect(emits[0]).toMatchObject({ userId: RECIPIENT, event: "new_notification" });
    expect(await getStreamStats(probe, stream, "g")).toEqual({ length: 1, pending: 0, deadLetters: 0 });
});

withRedis("the same business event published twice is handled only once", async ({ setup }) => {
    const repo = makeRepo();
    const { worker, publishNotification, emits } = setup({ repo });
    await worker.ensureGroup();

    await publishNotification(event());
    await publishNotification(event());
    await worker.processNew();

    expect(repo.state.calls).toBe(1); // the second message was skipped by the stream's done marker
    expect(repo.rows.size).toBe(1);
    expect(emits).toHaveLength(1);
});

withRedis("if the done marker is lost, the unique event id still prevents a second notification", async ({ stream, setup }) => {
    const repo = makeRepo();
    const { worker, publishNotification, emits } = setup({ repo });
    await worker.ensureGroup();

    const { eventId } = await publishNotification(event());
    await worker.processNew();
    // Redelivery with no stream key, as after a crash between the insert and the done marker.
    await publish(stream, NOTIFICATION_EVENT, {
        eventId, recipient: RECIPIENT, type: "connect_request_received",
        title: "New Connect Request", message: "You have a new connect request from a mentee", metadata: {},
    });
    await worker.processNew();

    expect(repo.state.calls).toBe(2); // the handler did run again...
    expect(repo.rows.size).toBe(1);   // ...but nothing was inserted twice
    expect(emits).toHaveLength(1);    // ...and the user was not notified twice
    expect((await getStreamStats(probe, stream, "g")).pending).toBe(0);
});

withRedis("a temporary database failure is retried until the notification is saved", async ({ stream, setup }) => {
    const repo = makeRepo({ failFirst: 1 });
    const { worker, publishNotification, emits } = setup({ repo });
    await worker.ensureGroup();

    await publishNotification(event());
    await worker.processNew();

    expect(repo.rows.size).toBe(0);
    expect((await getStreamStats(probe, stream, "g")).pending).toBe(1);

    await sleep(80);
    await worker.reclaim();

    expect(repo.rows.size).toBe(1);
    expect(emits).toHaveLength(1);
    expect((await getStreamStats(probe, stream, "g")).pending).toBe(0);
});

withRedis("notifications published while Communication was down are delivered when it starts", async ({ setup }) => {
    const repo = makeRepo();
    const { worker, publishNotification, emits } = setup({ repo });

    // no worker or consumer group exists yet
    await publishNotification(event({ dedupeKey: "first" }));
    await publishNotification(event({ dedupeKey: "second" }));

    await worker.ensureGroup();
    await worker.processNew();

    expect(repo.rows.size).toBe(2);
    expect(emits).toHaveLength(2);
});

withRedis("an invalid event is dead-lettered immediately and never reaches the repository", async ({ stream, setup }) => {
    const repo = makeRepo();
    const { worker } = setup({ repo });
    await worker.ensureGroup();

    await publish(stream, NOTIFICATION_EVENT, { eventId: "x", recipient: "not-an-id", type: "made_up", title: "", message: "" });
    await worker.processNew();

    expect(repo.state.calls).toBe(0);
    expect(await getStreamStats(probe, stream, "g")).toEqual({ length: 1, pending: 0, deadLetters: 1 });
    const [[, fields]] = await probe.xrange(`${stream}:dlq`, "-", "+");
    const dlq = {};
    for (let i = 0; i < fields.length; i += 2) dlq[fields[i]] = fields[i + 1];
    expect(dlq.error).toMatch(/Invalid notification event/);
});