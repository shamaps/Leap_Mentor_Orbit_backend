// utils/streams.js
// Small Redis Streams toolkit shared by every service.

const os = require("node:os");
const Redis = require("ioredis");
const config = require("../config/env");
const logger = require("./logger");

const DEFAULTS = {
    maxLen: 1_000_000,              // memory safety cap only; normal trimming is trimAcked()
    dlqMaxLen: 50_000,
    blockMs: 5_000,
    batch: 10,
    pendingScan: 100,               // how many pending entries reclaim() inspects per pass
    claimIdleMs: 60_000,            // also the first retry delay
    backoffFactor: 2,               // retry delays: 1m, 2m, 4m, 8m ... (capped by maxBackoffMs)
    maxBackoffMs: 15 * 60_000,
    maxAttempts: 5,
    handlerTimeoutMs: 5 * 60_000,
    doneTtlSec: 24 * 60 * 60,
    publishTimeoutMs: 2_000,
    housekeepingMs: 60_000,
    consumerPruneIdleMs: 60 * 60_000,
    pendingWarnAt: 100,
};

// 4xx means "the target understood and rejected it": retrying will not help.
// These 4xx can be temporary, so they stay retryable.
const RETRYABLE_4XX = new Set([408, 409, 423, 425, 429]);

const isPermanentFailure = (err) => {
    if (err?.retryable === false) return true;
    const status = Number(err?.status ?? err?.statusCode);
    return status >= 400 && status < 500 && !RETRYABLE_4XX.has(status);
};

const connectionOptions = (extra = {}) => ({
    host: config.streamsRedisHost,
    port: config.streamsRedisPort,
    password: config.streamsRedisPassword,
    tls: config.streamsRedisTls ? {} : undefined,
    db: config.streamsRedisDb,
    ...extra,
});

/** A new Redis client for the streams instance (used by tools/replayDlq.js and tests). */
const createClient = (extra) => new Redis(connectionOptions(extra));

// ── Producer ──────────────────────────────────────────────────
let producer = null;
const getProducer = () => {
    if (!producer) {
        producer = createClient({ maxRetriesPerRequest: 1 });
        producer.on("error", (err) => logger.warn("Redis streams producer error", { error: err.message }));
    }
    return producer;
};

const raceTimeout = (promise, ms, label) => {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error(`${label} timed out after ${ms}ms`), { code: "TIMEOUT" })), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

/**
 * Adds a message to a stream. Rejects if Redis is unreachable within the timeout,
 * so callers can decide on a fallback instead of hanging.
 *
 * A timeout is ambiguous: the XADD may still have landed. When a `key` is given the
 * worker de-duplicates by it, so one retry is safe and removes most double deliveries.
 * Always pass a `key` for anything that must not run twice.
 */
const publish = async (stream, type, payload, { maxLen = DEFAULTS.maxLen, key = "", client } = {}) => {
    if (!stream || !type) throw new Error("publish: stream and type are required");
    const redis = client || getProducer();
    const fields = ["type", type, "payload", JSON.stringify(payload ?? {}), "key", key, "ts", String(Date.now())];
    const send = () => raceTimeout(
        redis.xadd(stream, "MAXLEN", "~", String(maxLen), "*", ...fields),
        DEFAULTS.publishTimeoutMs,
        "stream publish"
    );
    try {
        return await send();
    } catch (err) {
        if (key && err.code === "TIMEOUT") return send();
        throw err;
    }
};

const closeProducer = async () => {
    if (!producer) return;
    const current = producer;
    producer = null;
    await current.quit().catch(() => current.disconnect());
};

// ── Helpers ───────────────────────────────────────────────────
const toObject = (flat = []) => {
    const out = {};
    for (let i = 0; i < flat.length; i += 2) out[flat[i]] = flat[i + 1];
    return out;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Worker ────────────────────────────────────────────────────
const createWorker = ({
    stream,
    group,
    handlers,
    consumer = `${os.hostname()}:${process.pid}`,
    maxAttempts = DEFAULTS.maxAttempts,
    blockMs = DEFAULTS.blockMs,
    batch = DEFAULTS.batch,
    pendingScan = DEFAULTS.pendingScan,
    claimIdleMs = DEFAULTS.claimIdleMs,
    backoffFactor = DEFAULTS.backoffFactor,
    maxBackoffMs = DEFAULTS.maxBackoffMs,
    handlerTimeoutMs = DEFAULTS.handlerTimeoutMs,
    doneTtlSec = DEFAULTS.doneTtlSec,
    housekeepingMs = DEFAULTS.housekeepingMs,
    consumerPruneIdleMs = DEFAULTS.consumerPruneIdleMs,
    pendingWarnAt = DEFAULTS.pendingWarnAt,
    dlqStream = `${stream}:dlq`,
    redisOptions = {},
    log = logger,
}) => {
    if (!stream || !group || !handlers) throw new Error("createWorker: stream, group and handlers are required");

    const cmd = createClient(redisOptions);    // normal commands
    const reader = createClient(redisOptions); // blocking reads only
    for (const client of [cmd, reader]) {
        client.on("error", (err) => log.warn("Redis streams worker error", { stream, error: err.message }));
    }

    const lastErrors = new Map(); // message id -> last handler error (this process only)
    const owned = new Map();      // message id -> stop heartbeating after this timestamp
    const lingering = new Set();  // handler timed out but is still running
    let heartbeatTimer = null;
    let running = false;
    let loop = null;
    let lastHousekeeping = 0;

    const beat = () => {
        const now = Date.now();
        const ids = [];
        for (const [id, until] of owned) {
            if (until < now) owned.delete(id); else ids.push(id);
        }
        if (ids.length) cmd.xclaim(stream, group, consumer, 0, ...ids, "JUSTID").catch(() => { });
    };

    const doneKey = (key) => `streams:done:${stream}:${group}:${key}`;

    // How long a message must sit idle after its Nth delivery before it is retried.
    const backoffFor = (deliveries) =>
        Math.min(maxBackoffMs, Math.round(claimIdleMs * backoffFactor ** Math.max(0, deliveries - 1)));

    const ensureGroup = async () => {
        try {
            // "0": a new group starts from the beginning, so messages published
            // before the worker ever ran are not lost.
            await cmd.xgroup("CREATE", stream, group, "0", "MKSTREAM");
        } catch (err) {
            if (!String(err.message).includes("BUSYGROUP")) throw err;
        }
    };

    const ack = (id) => cmd.xack(stream, group, id);

    const deadLetter = async (id, fields, reason) => {
        log.error("Stream message moved to dead-letter stream", { stream, dlqStream, id, type: fields?.type, reason });
        await cmd.xadd(dlqStream, "MAXLEN", "~", String(DEFAULTS.dlqMaxLen), "*",
            ...Object.entries(fields || {}).flat(),
            "error", String(reason).slice(0, 1000), "originalId", id, "group", group, "failedAt", String(Date.now()));
        await cmd.xack(stream, group, id);
        lastErrors.delete(id);
    };

    const handleMessage = async (id, fields, deliveries) => {
        const { type, payload, key } = fields;
        const handler = handlers[type];
        if (!handler) return deadLetter(id, fields, `no handler for type "${type}"`);

        let data;
        try {
            data = JSON.parse(payload);
        } catch {
            return deadLetter(id, fields, "payload is not valid JSON");
        }

        if (key && (await cmd.get(doneKey(key)))) {
            await ack(id); // already completed earlier (duplicate delivery)
            return;
        }

        const running = Promise.resolve().then(() => handler(data, { id, type, key, deliveries }));
        try {
            await raceTimeout(running, handlerTimeoutMs, `handler ${type}`);
        } catch (err) {
            if (err.code === "TIMEOUT") {
                // Handler is still running: keep the message ours until it really stops.
                lingering.add(id);
                owned.set(id, Date.now() + handlerTimeoutMs);
                running.catch(() => { }).finally(() => { lingering.delete(id); owned.delete(id); });
            }
            if (isPermanentFailure(err)) {
                return deadLetter(id, fields, `permanent failure: ${err.message}`);
            }
            lastErrors.set(id, err.message);
            log.warn("Stream job failed; it will be retried", { stream, id, type, deliveries, error: err.message });
            return;
        }

        if (key) await cmd.set(doneKey(key), "1", "EX", doneTtlSec);
        await ack(id);
        lastErrors.delete(id);
    };

    /** Reads and handles brand-new messages. Returns how many were read. */
    const processNew = async (block = 0) => {
        const args = ["GROUP", group, consumer, "COUNT", String(batch)];
        if (block > 0) args.push("BLOCK", String(block));
        args.push("STREAMS", stream, ">");
        const result = await (block > 0 ? reader : cmd).xreadgroup(...args);
        const entries = result?.[0]?.[1] || [];
        for (const [id] of entries) owned.set(id, Infinity);
        try {
            for (const [id, flat] of entries) await handleMessage(id, toObject(flat), 1);
        } finally {
            for (const [id] of entries) if (!lingering.has(id)) owned.delete(id);
        }
        return entries.length;
    };

    /** Retries stale pending messages (failed or abandoned) with backoff; dead-letters exhausted ones. */
    const reclaim = async () => {
        let handled = 0;
        let pendingStart = "-";
        for (let page = 0; page < 10 && handled < batch; page++) {
            const pending = await cmd.xpending(stream, group, "IDLE", String(claimIdleMs), pendingStart, "+", String(pendingScan));
            if (!pending.length) break;
            for (const [id, , idleMs, deliveries] of pending) {
                if (handled >= batch) break;
                const attempts = Number(deliveries);

                if (attempts >= maxAttempts) {
                    const [entry] = await cmd.xrange(stream, id, id);
                    if (entry) {
                        await deadLetter(id, toObject(entry[1]), lastErrors.get(id) || `gave up after ${attempts} attempts`);
                    } else {
                        log.error("Stream message was trimmed before it was processed; it is lost", { stream, id });
                        await ack(id);
                    }
                    handled += 1;
                    continue;
                }

                const needIdle = backoffFor(attempts);
                if (Number(idleMs) < needIdle) continue; // still backing off

                const claimed = await cmd.xclaim(stream, group, consumer, String(needIdle), id);
                if (!claimed.length) continue; // someone else got it, or it was trimmed
                for (const [claimedId, flat] of claimed) {
                    if (!flat) {
                        log.error("Stream message was trimmed before it was processed; it is lost", { stream, id: claimedId });
                        await ack(claimedId);
                        continue;
                    }
                    owned.set(claimedId, Infinity);
                    try { await handleMessage(claimedId, toObject(flat), attempts + 1); }
                    finally { if (!lingering.has(claimedId)) owned.delete(claimedId); }
                    handled += 1;
                }
            }
            if (pending.length < pendingScan) break;
            pendingStart = `(${pending[pending.length - 1][0]}`; // exclusive start, Redis 6.2+
        }
        return handled;
    };

    // ── Housekeeping ──────────────────────────────────────────
    /**
     * Removes only messages that are finished: everything older than the oldest
     * pending message (or, with nothing pending, everything already delivered).
     * Replaces blind MAXLEN trimming, which could delete jobs nobody had processed.
     */
    const trimAcked = async () => {
        const groups = await cmd.xinfo("GROUPS", stream);
        const lastDelivered = groups.map(toObject).find((g) => g.name === group)?.["last-delivered-id"];
        const summary = await cmd.xpending(stream, group);
        const safeId = Number(summary?.[0]) > 0 ? summary[1] : lastDelivered;
        if (!safeId || safeId === "0-0") return 0;
        return cmd.xtrim(stream, "MINID", safeId);
    };

    const listConsumers = async () => (await cmd.xinfo("CONSUMERS", stream, group)).map(toObject);

    /** Deletes consumers left behind by old containers. Never touches one that still owns pending jobs. */
    const pruneConsumers = async () => {
        for (const c of await listConsumers()) {
            if (c.name === consumer) continue;
            if (Number(c.pending) === 0 && Number(c.idle) > consumerPruneIdleMs) {
                await cmd.xgroup("DELCONSUMER", stream, group, c.name);
            }
        }
    };

    const removeSelfIfIdle = async () => {
        const self = (await listConsumers()).find((c) => c.name === consumer);
        if (self && Number(self.pending) === 0) await cmd.xgroup("DELCONSUMER", stream, group, consumer);
    };

    const reportStats = async () => {
        const stats = await getStreamStats(cmd, stream, group, dlqStream);
        if (stats.deadLetters > 0) {
            log.error("Dead-letter stream has messages that need attention", {
                stream, dlqStream, ...stats, replay: `node tools/replayDlq.js ${stream}`,
            });
        } else if (stats.pending > pendingWarnAt) {
            log.warn("Stream has many unacknowledged jobs", { stream, ...stats });
        }
    };

    const verifyRedisConfig = async () => {
        try {
            const [, policy] = await cmd.config("GET", "maxmemory-policy");
            const [, aof] = await cmd.config("GET", "appendonly");
            const report = config.isProduction ? log.error : log.warn;
            if (policy !== "noeviction") {
                report.call(log, "Redis maxmemory-policy is not 'noeviction': stream messages can be evicted", { stream, policy });
            }
            if (aof !== "yes") {
                report.call(log, "Redis appendonly is off: stream messages are lost if Redis restarts", { stream, appendonly: aof });
            }
        } catch (err) {
            log.warn("Could not verify Redis persistence settings (CONFIG may be disabled)", { stream, error: err.message });
        }
    };

    const housekeeping = async () => {
        if (Date.now() - lastHousekeeping < housekeepingMs) return;
        lastHousekeeping = Date.now();
        for (const [name, task] of [["trim", trimAcked], ["prune consumers", pruneConsumers], ["report stats", reportStats]]) {
            try {
                await task();
            } catch (err) {
                log.warn(`Stream housekeeping failed: ${name}`, { stream, error: err.message });
            }
        }
    };

    const run = async () => {
        await ensureGroup();
        await verifyRedisConfig();
        while (running) {
            try {
                await reclaim();
                await housekeeping();
                await processNew(blockMs);
            } catch (err) {
                if (!running) break;
                log.error("Stream worker loop error", { stream, group, error: err.message });
                await sleep(1_000);
            }
        }
    };

    const start = () => {
        if (running) return loop;
        running = true;
        heartbeatTimer = setInterval(beat, Math.max(10, Math.floor(claimIdleMs / 3)));
        heartbeatTimer.unref?.();
        loop = run();
        log.info("Stream worker started", { stream, group, consumer });
        return loop;
    };

    const stop = async () => {
        running = false;
        clearInterval(heartbeatTimer);
        reader.disconnect(); // interrupts the blocking read
        await loop?.catch(() => { });
        await removeSelfIfIdle().catch(() => { });
        await cmd.quit().catch(() => cmd.disconnect());
        log.info("Stream worker stopped", { stream, group, consumer });
    };

    return { start, stop, ensureGroup, processNew, reclaim, trimAcked, pruneConsumers, _cmd: cmd };
};

/** Numbers worth alerting on: backlog, un-acked jobs, and dead letters. */
const getStreamStats = async (client, stream, group, dlqStream = `${stream}:dlq`) => {
    const [length, dead, pending] = await Promise.all([
        client.xlen(stream).catch(() => 0),
        client.xlen(dlqStream).catch(() => 0),
        client.xpending(stream, group).catch(() => [0]),
    ]);
    return { length, pending: Number(pending?.[0] || 0), deadLetters: dead };
};

module.exports = { publish, createWorker, getStreamStats, closeProducer, createClient, isPermanentFailure, DEFAULTS };
