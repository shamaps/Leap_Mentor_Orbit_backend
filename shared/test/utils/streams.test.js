/**
 * Unit tests for shared/utils/streams.js.
 *
 * ioredis is replaced with an in-memory fake, so these run without a Redis server.
 * (services/communication-service/test/streams.test.js still covers the real-Redis path.)
 */
const { mockLog } = require("../helpers");

jest.mock("../../utils/logger", () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));
jest.mock("ioredis", () => jest.fn());

const Redis = require("ioredis");
const {
    publish, createWorker, getStreamStats, closeProducer, createClient, isPermanentFailure, DEFAULTS,
} = require("../../utils/streams");

const STREAM = "test:stream";
const GROUP = "g";
const flat = (obj) => Object.entries(obj).flat();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A fake ioredis client. Every command is a jest.fn with a harmless default. */
const makeClient = () => {
    const chain = {};
    chain.xadd = jest.fn().mockReturnValue(chain);
    chain.xack = jest.fn().mockReturnValue(chain);
    chain.exec = jest.fn().mockResolvedValue([]);
    return {
        _chain: chain,
        on: jest.fn(),
        xadd: jest.fn().mockResolvedValue("1-0"),
        xgroup: jest.fn().mockResolvedValue("OK"),
        xack: jest.fn().mockResolvedValue(1),
        xclaim: jest.fn().mockResolvedValue([]),
        xreadgroup: jest.fn().mockResolvedValue(null),
        xpending: jest.fn().mockResolvedValue([]),
        xrange: jest.fn().mockResolvedValue([]),
        xinfo: jest.fn().mockResolvedValue([]),
        xtrim: jest.fn().mockResolvedValue(0),
        xlen: jest.fn().mockResolvedValue(0),
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue("OK"),
        config: jest.fn().mockImplementation((_op, name) =>
            Promise.resolve([name, name === "appendonly" ? "yes" : "noeviction"])),
        multi: jest.fn().mockReturnValue(chain),
        quit: jest.fn().mockResolvedValue("OK"),
        disconnect: jest.fn(),
    };
};

let clients;
let workers;
beforeEach(() => {
    clients = [];
    workers = [];
    Redis.mockImplementation(() => {
        const c = makeClient();
        clients.push(c);
        return c;
    });
});

afterEach(async () => {
    // Stop any worker a test forgot to stop (e.g. because an assertion threw first),
    // so a failure in one test can never leak a running loop into the next.
    await Promise.all(workers.map((w) => w.stop().catch(() => { })));
    await closeProducer();
    jest.useRealTimers();
});

/** Builds a worker; clients[0] is the command client, clients[1] the blocking reader. */
const build = (opts = {}) => {
    const log = mockLog();
    const worker = createWorker({
        stream: STREAM, group: GROUP, log, claimIdleMs: 100, backoffFactor: 2,
        handlers: {}, ...opts,
    });
    workers.push(worker);
    const [cmd, reader] = clients.slice(-2);
    return { worker, cmd, reader, log };
};

/**
 * Fake for the BLOCKING reader client: returns `first` once (if given), then behaves like a
 * real blocking XREADGROUP that times out empty after a few ms.
 *
 * The delay matters. A mock that resolves instantly (mockResolvedValue(null)) turns the worker
 * loop into a microtask spin that starves timers (sleep, heartbeat setInterval) and
 * exhausts the heap.
 */
const mockBlockingReads = (reader, first, blockMs = 5) => {
    reader.xreadgroup.mockImplementation(() => sleep(blockMs).then(() => null));
    if (first) reader.xreadgroup.mockImplementationOnce(() => Promise.resolve(first));
};

/** Housekeeping/reclaim answers an idle worker loop needs (nothing pending, nothing to trim). */
const mockIdleLoopCommands = (cmd) => {
    cmd.xinfo.mockImplementation((what) =>
        Promise.resolve(what === "GROUPS" ? [flat({ name: GROUP, "last-delivered-id": "0-0" })] : []));
    // XPENDING has two shapes: summary (no extra args) and extended range (IDLE ...).
    cmd.xpending.mockImplementation((_s, _g, ...rest) =>
        Promise.resolve(rest.length ? [] : [0, null, null, null]));
};

/** Makes the next xreadgroup (non-blocking) return the given messages. */
const deliver = (client, messages) =>
    client.xreadgroup.mockResolvedValueOnce([[STREAM, messages.map(({ id, ...fields }) => [id, flat(fields)])]]);

const msg = (id, type, payload = {}, key = "") => ({ id, type, payload: JSON.stringify(payload), key });

describe("isPermanentFailure", () => {
    test.each([
        [{ retryable: false }, true],
        [{ retryable: false, status: 503 }, true],
        [{ status: 400 }, true],
        [{ status: 404 }, true],
        [{ statusCode: 422 }, true],
        [{ status: 408 }, false],
        [{ status: 409 }, false],
        [{ status: 423 }, false],
        [{ status: 425 }, false],
        [{ status: 429 }, false],
        [{ status: 500 }, false],
        [{ status: 503 }, false],
        [{ status: 302 }, false],
        [{ message: "boom" }, false],
        [undefined, false],
        [null, false],
    ])("%j -> %s", (err, expected) => {
        expect(isPermanentFailure(err)).toBe(expected);
    });
});

describe("createClient", () => {
    test("passes the streams Redis settings and any extra options to ioredis", () => {
        createClient({ maxRetriesPerRequest: 1 });
        expect(Redis).toHaveBeenCalledTimes(1);
        expect(Redis.mock.calls[0][0]).toMatchObject({
            host: expect.any(String),
            port: expect.any(Number),
            db: expect.any(Number),
            maxRetriesPerRequest: 1,
        });
    });
});

describe("publish", () => {
    test("rejects when stream or type is missing", async () => {
        const client = makeClient();
        await expect(publish("", "t", {}, { client })).rejects.toThrow(/stream and type are required/);
        await expect(publish(STREAM, "", {}, { client })).rejects.toThrow(/stream and type are required/);
        expect(client.xadd).not.toHaveBeenCalled();
    });

    test("XADDs type, JSON payload, key and a timestamp with an approximate MAXLEN", async () => {
        const client = makeClient();
        client.xadd.mockResolvedValue("123-0");
        const id = await publish(STREAM, "hello", { a: 1 }, { client, key: "k1", maxLen: 500 });

        expect(id).toBe("123-0");
        const args = client.xadd.mock.calls[0];
        expect(args.slice(0, 5)).toEqual([STREAM, "MAXLEN", "~", "500", "*"]);
        const fields = Object.fromEntries(
            Array.from({ length: (args.length - 5) / 2 }, (_, i) => [args[5 + i * 2], args[6 + i * 2]])
        );
        expect(fields).toMatchObject({ type: "hello", payload: '{"a":1}', key: "k1" });
        expect(Number(fields.ts)).toBeGreaterThan(0);
    });

    test("defaults: empty key, {} payload, DEFAULTS.maxLen", async () => {
        const client = makeClient();
        await publish(STREAM, "hello", undefined, { client });
        const args = client.xadd.mock.calls[0];
        expect(args[3]).toBe(String(DEFAULTS.maxLen));
        expect(args).toEqual(expect.arrayContaining(["payload", "{}", "key", ""]));
    });

    test("uses a lazily created shared producer when no client is passed", async () => {
        await publish(STREAM, "a", {});
        await publish(STREAM, "b", {});
        expect(Redis).toHaveBeenCalledTimes(1); // one producer, reused
        expect(clients[0].xadd).toHaveBeenCalledTimes(2);
        expect(Redis.mock.calls[0][0]).toMatchObject({ maxRetriesPerRequest: 1 });
    });

    test("propagates non-timeout errors without retrying, even with a key", async () => {
        const client = makeClient();
        client.xadd.mockRejectedValue(new Error("READONLY"));
        await expect(publish(STREAM, "t", {}, { client, key: "k" })).rejects.toThrow("READONLY");
        expect(client.xadd).toHaveBeenCalledTimes(1);
    });

    describe("timeouts", () => {
        beforeEach(() => jest.useFakeTimers());

        test("without a key a timeout is NOT retried (it could double-send)", async () => {
            const client = makeClient();
            client.xadd.mockReturnValue(new Promise(() => { }));
            const p = publish(STREAM, "t", {}, { client });
            const assertion = expect(p).rejects.toMatchObject({ code: "TIMEOUT", message: expect.stringMatching(/timed out/) });
            await jest.advanceTimersByTimeAsync(DEFAULTS.publishTimeoutMs);
            await assertion;
            expect(client.xadd).toHaveBeenCalledTimes(1);
        });

        test("with a key a timeout is retried once and can succeed", async () => {
            const client = makeClient();
            client.xadd.mockReturnValueOnce(new Promise(() => { })).mockResolvedValueOnce("9-0");
            const p = publish(STREAM, "t", {}, { client, key: "k" });
            await jest.advanceTimersByTimeAsync(DEFAULTS.publishTimeoutMs);
            await expect(p).resolves.toBe("9-0");
            expect(client.xadd).toHaveBeenCalledTimes(2);
        });

        test("with a key, two timeouts in a row reject (only one retry)", async () => {
            const client = makeClient();
            client.xadd.mockReturnValue(new Promise(() => { }));
            const p = publish(STREAM, "t", {}, { client, key: "k" });
            const assertion = expect(p).rejects.toMatchObject({ code: "TIMEOUT" });
            await jest.advanceTimersByTimeAsync(DEFAULTS.publishTimeoutMs * 2);
            await assertion;
            expect(client.xadd).toHaveBeenCalledTimes(2);
        });
    });
});

describe("closeProducer", () => {
    test("is a no-op when no producer exists", async () => {
        await expect(closeProducer()).resolves.toBeUndefined();
    });

    test("quits the producer and lets the next publish create a fresh one", async () => {
        await publish(STREAM, "a", {});
        const first = clients[0];
        await closeProducer();
        expect(first.quit).toHaveBeenCalled();
        await publish(STREAM, "b", {});
        expect(clients).toHaveLength(2);
    });

    test("falls back to disconnect() if quit() fails", async () => {
        await publish(STREAM, "a", {});
        clients[0].quit.mockRejectedValue(new Error("closed"));
        await closeProducer();
        expect(clients[0].disconnect).toHaveBeenCalled();
    });
});

describe("createWorker", () => {
    test.each([
        [{ group: GROUP, handlers: {} }],
        [{ stream: STREAM, handlers: {} }],
        [{ stream: STREAM, group: GROUP }],
    ])("throws when stream, group or handlers is missing (%#)", (opts) => {
        expect(() => createWorker(opts)).toThrow(/stream, group and handlers are required/);
    });

    test("opens a command client and a separate blocking reader, and logs client errors as warnings", () => {
        const { cmd, reader, log } = build();
        expect(clients).toHaveLength(2);
        expect(cmd).not.toBe(reader);
        const onError = cmd.on.mock.calls.find(([event]) => event === "error")[1];
        onError(new Error("ECONNRESET"));
        expect(log.warn).toHaveBeenCalledWith("Redis streams worker error", { stream: STREAM, error: "ECONNRESET" });
    });

    describe("ensureGroup", () => {
        test("creates the group from the beginning with MKSTREAM", async () => {
            const { worker, cmd } = build();
            await worker.ensureGroup();
            expect(cmd.xgroup).toHaveBeenCalledWith("CREATE", STREAM, GROUP, "0", "MKSTREAM");
        });

        test("ignores BUSYGROUP (group already exists)", async () => {
            const { worker, cmd } = build();
            cmd.xgroup.mockRejectedValue(new Error("BUSYGROUP Consumer Group name already exists"));
            await expect(worker.ensureGroup()).resolves.toBeUndefined();
        });

        test("rethrows any other error", async () => {
            const { worker, cmd } = build();
            cmd.xgroup.mockRejectedValue(new Error("NOPERM"));
            await expect(worker.ensureGroup()).rejects.toThrow("NOPERM");
        });
    });

    describe("processNew", () => {
        test("returns 0 when nothing is delivered", async () => {
            const { worker } = build();
            await expect(worker.processNew()).resolves.toBe(0);
        });

        test("non-blocking read goes through the command client with the configured batch", async () => {
            const { worker, cmd, reader } = build({ batch: 7, consumer: "c1" });
            await worker.processNew();
            expect(cmd.xreadgroup).toHaveBeenCalledWith("GROUP", GROUP, "c1", "COUNT", "7", "STREAMS", STREAM, ">");
            expect(reader.xreadgroup).not.toHaveBeenCalled();
        });

        test("blocking read goes through the reader client with BLOCK", async () => {
            const { worker, cmd, reader } = build({ consumer: "c1" });
            await worker.processNew(250);
            expect(reader.xreadgroup).toHaveBeenCalledWith(
                "GROUP", GROUP, "c1", "COUNT", String(DEFAULTS.batch), "BLOCK", "250", "STREAMS", STREAM, ">");
            expect(cmd.xreadgroup).not.toHaveBeenCalled();
        });

        test("runs the handler with parsed data and delivery metadata, then ACKs", async () => {
            const handler = jest.fn().mockResolvedValue(undefined);
            const { worker, cmd } = build({ handlers: { hello: handler } });
            deliver(cmd, [msg("1-0", "hello", { name: "Asha" })]);

            await expect(worker.processNew()).resolves.toBe(1);
            expect(handler).toHaveBeenCalledWith({ name: "Asha" }, { id: "1-0", type: "hello", key: "", deliveries: 1 });
            expect(cmd.xack).toHaveBeenCalledWith(STREAM, GROUP, "1-0");
        });

        test("handles every message of a batch in order", async () => {
            const seen = [];
            const { worker, cmd } = build({ handlers: { n: async (d) => seen.push(d.n) } });
            deliver(cmd, [msg("1-0", "n", { n: 1 }), msg("2-0", "n", { n: 2 }), msg("3-0", "n", { n: 3 })]);
            await expect(worker.processNew()).resolves.toBe(3);
            expect(seen).toEqual([1, 2, 3]);
            expect(cmd.xack).toHaveBeenCalledTimes(3);
        });

        test("works with a synchronous handler", async () => {
            const handler = jest.fn();
            const { worker, cmd } = build({ handlers: { sync: handler } });
            deliver(cmd, [msg("1-0", "sync")]);
            await worker.processNew();
            expect(cmd.xack).toHaveBeenCalledTimes(1);
        });

        describe("idempotency keys", () => {
            test("marks the key done (with TTL) after success", async () => {
                const { worker, cmd } = build({ handlers: { t: jest.fn() }, doneTtlSec: 99 });
                deliver(cmd, [msg("1-0", "t", {}, "abc")]);
                await worker.processNew();
                expect(cmd.set).toHaveBeenCalledWith(`streams:done:${STREAM}:${GROUP}:abc`, "1", "EX", 99);
                expect(cmd.xack).toHaveBeenCalledWith(STREAM, GROUP, "1-0");
            });

            test("a message whose key is already done is ACKed without running the handler", async () => {
                const handler = jest.fn();
                const { worker, cmd } = build({ handlers: { t: handler } });
                cmd.get.mockResolvedValue("1");
                deliver(cmd, [msg("1-0", "t", {}, "abc")]);
                await worker.processNew();
                expect(handler).not.toHaveBeenCalled();
                expect(cmd.xack).toHaveBeenCalledWith(STREAM, GROUP, "1-0");
                expect(cmd.set).not.toHaveBeenCalled();
            });

            test("messages without a key never touch the done-marker", async () => {
                const { worker, cmd } = build({ handlers: { t: jest.fn() } });
                deliver(cmd, [msg("1-0", "t")]);
                await worker.processNew();
                expect(cmd.get).not.toHaveBeenCalled();
                expect(cmd.set).not.toHaveBeenCalled();
            });

            test("a failed handler does not mark the key done", async () => {
                const { worker, cmd } = build({ handlers: { t: jest.fn().mockRejectedValue(new Error("x")) } });
                deliver(cmd, [msg("1-0", "t", {}, "abc")]);
                await worker.processNew();
                expect(cmd.set).not.toHaveBeenCalled();
            });
        });

        describe("dead-lettering", () => {
            const expectDeadLettered = (cmd, id, reasonPattern) => {
                expect(cmd.xadd).toHaveBeenCalledTimes(1);
                const args = cmd.xadd.mock.calls[0];
                expect(args.slice(0, 4)).toEqual([`${STREAM}:dlq`, "MAXLEN", "~", String(DEFAULTS.dlqMaxLen)]);
                expect(args).toEqual(expect.arrayContaining(["originalId", id, "group", GROUP]));
                const reason = args[args.indexOf("error") + 1];
                expect(reason).toMatch(reasonPattern);
                expect(cmd.xack).toHaveBeenCalledWith(STREAM, GROUP, id);
                expect(cmd.xadd.mock.invocationCallOrder[0]).toBeLessThan(cmd.xack.mock.invocationCallOrder[0]);
                expect(cmd.multi).not.toHaveBeenCalled();
            };

            test("an unknown message type goes straight to the DLQ", async () => {
                const { worker, cmd, log } = build({ handlers: {} });
                deliver(cmd, [msg("1-0", "mystery")]);
                await worker.processNew();
                expectDeadLettered(cmd, "1-0", /no handler for type "mystery"/);
                expect(log.error).toHaveBeenCalledWith(
                    "Stream message moved to dead-letter stream",
                    expect.objectContaining({ stream: STREAM, id: "1-0", type: "mystery" }));
            });

            test("an unparsable payload goes straight to the DLQ and the handler never runs", async () => {
                const handler = jest.fn();
                const { worker, cmd } = build({ handlers: { t: handler } });
                deliver(cmd, [{ id: "1-0", type: "t", payload: "{not json", key: "" }]);
                await worker.processNew();
                expect(handler).not.toHaveBeenCalled();
                expectDeadLettered(cmd, "1-0", /not valid JSON/);
            });

            test.each([
                ["status 400", Object.assign(new Error("bad input"), { status: 400 })],
                ["statusCode 404", Object.assign(new Error("gone"), { statusCode: 404 })],
                ["retryable:false", Object.assign(new Error("never"), { retryable: false })],
            ])("a permanent handler failure (%s) goes to the DLQ on the first delivery", async (_n, err) => {
                const { worker, cmd } = build({ handlers: { t: jest.fn().mockRejectedValue(err) } });
                deliver(cmd, [msg("1-0", "t")]);
                await worker.processNew();
                expectDeadLettered(cmd, "1-0", new RegExp(`permanent failure: ${err.message}`));
            });

            test("does not ACK when writing the DLQ fails", async () => {
                const { worker, cmd } = build({ handlers: {} });
                cmd.xadd.mockRejectedValueOnce(new Error("Redis unavailable"));
                deliver(cmd, [msg("1-0", "missing")]);
                await expect(worker.processNew()).rejects.toThrow("Redis unavailable");
                expect(cmd.xack).not.toHaveBeenCalled();
            });

            test("long error reasons are truncated to 1000 characters", async () => {
                const err = Object.assign(new Error("x".repeat(5000)), { status: 400 });
                const { worker, cmd } = build({ handlers: { t: jest.fn().mockRejectedValue(err) } });
                deliver(cmd, [msg("1-0", "t")]);
                await worker.processNew();
                const args = cmd.xadd.mock.calls[0];
                expect(args[args.indexOf("error") + 1]).toHaveLength(1000);
            });
        });

        describe("transient failures", () => {
            test("leave the message pending: no ACK, no DLQ, a warning is logged", async () => {
                const { worker, cmd, log } = build({ handlers: { t: jest.fn().mockRejectedValue(new Error("smtp down")) } });
                deliver(cmd, [msg("1-0", "t")]);
                await worker.processNew();
                expect(cmd.xack).not.toHaveBeenCalled();
                expect(cmd.xadd).not.toHaveBeenCalled();
                expect(log.warn).toHaveBeenCalledWith(
                    "Stream job failed; it will be retried",
                    expect.objectContaining({ id: "1-0", type: "t", deliveries: 1, error: "smtp down" }));
            });

            test.each([408, 409, 423, 425, 429, 500, 503])("HTTP %i is treated as retryable", async (status) => {
                const err = Object.assign(new Error("later"), { status });
                const { worker, cmd } = build({ handlers: { t: jest.fn().mockRejectedValue(err) } });
                deliver(cmd, [msg("1-0", "t")]);
                await worker.processNew();
                expect(cmd.xadd).not.toHaveBeenCalled();
                expect(cmd.xack).not.toHaveBeenCalled();
            });

            test("a handler that outlives handlerTimeoutMs is treated as a retryable failure", async () => {
                const { worker, cmd, log } = build({
                    handlerTimeoutMs: 20, handlers: { slow: () => new Promise(() => { }) },
                });
                deliver(cmd, [msg("1-0", "slow")]);
                await worker.processNew();
                expect(cmd.xack).not.toHaveBeenCalled();
                expect(cmd.xadd).not.toHaveBeenCalled();
                expect(log.warn).toHaveBeenCalledWith(
                    "Stream job failed; it will be retried",
                    expect.objectContaining({ error: expect.stringMatching(/handler slow timed out after 20ms/) }));
            });
        });

        test("worker heartbeat keeps every message in a batch owned while an earlier handler runs", async () => {
            let releaseFirst;
            let firstStarted;
            const started = new Promise((resolve) => { firstStarted = resolve; });
            const gate = new Promise((resolve) => { releaseFirst = resolve; });
            const { worker, cmd, reader } = build({
                blockMs: 5, claimIdleMs: 18, consumer: "c1",
                handlers: { slow: async (data) => { if (data.n === 1) { firstStarted(); await gate; } } },
            });
            mockIdleLoopCommands(cmd);
            mockBlockingReads(reader, [[STREAM, [
                ["1-0", flat({ type: "slow", payload: '{"n":1}', key: "" })],
                ["2-0", flat({ type: "slow", payload: '{"n":2}', key: "" })],
            ]]]);

            worker.start();
            await started;
            await sleep(30);
            // Message 2-0 has not run yet, but it is already ours, so it is heartbeated too.
            expect(cmd.xclaim).toHaveBeenCalledWith(STREAM, GROUP, "c1", 0, "1-0", "2-0", "JUSTID");
            releaseFirst();
            await sleep(20);
            await worker.stop();
            expect(cmd.xack).toHaveBeenCalledWith(STREAM, GROUP, "1-0");
            expect(cmd.xack).toHaveBeenCalledWith(STREAM, GROUP, "2-0");
        });

        test("heartbeat failures are swallowed while the worker continues", async () => {
            const { worker, cmd, reader } = build({
                blockMs: 5, claimIdleMs: 15, handlers: { slow: () => sleep(40) },
            });
            mockIdleLoopCommands(cmd);
            mockBlockingReads(reader, [[STREAM, [["1-0", flat({ type: "slow", payload: "{}", key: "" })]]]]);
            cmd.xclaim.mockRejectedValue(new Error("nope"));

            worker.start();
            await sleep(80); // handler takes 40ms; leave headroom so it has finished and ACKed
            await worker.stop();
            expect(cmd.xclaim).toHaveBeenCalled();
            expect(cmd.xack).toHaveBeenCalledWith(STREAM, GROUP, "1-0");
        });

        test("a timed-out handler stays heartbeat-owned until it settles", async () => {
            let settle;
            const handler = jest.fn(() => new Promise((resolve) => { settle = resolve; }));
            const { worker, cmd, reader } = build({
                blockMs: 5, claimIdleMs: 12, handlerTimeoutMs: 20, consumer: "c1", handlers: { slow: handler },
            });
            mockIdleLoopCommands(cmd);
            mockBlockingReads(reader, [[STREAM, [["1-0", flat({ type: "slow", payload: "{}", key: "" })]]]]);

            worker.start();
            await sleep(60);
            expect(handler).toHaveBeenCalledTimes(1);
            expect(cmd.xclaim).toHaveBeenCalledWith(STREAM, GROUP, "c1", 0, "1-0", "JUSTID");
            // The timeout is a retryable failure: the message is neither ACKed nor dead-lettered.
            expect(cmd.xack).not.toHaveBeenCalled();
            expect(cmd.xadd).not.toHaveBeenCalled();

            settle();
            await sleep(10);
            await worker.stop();
        });
    });

    describe("reclaim", () => {
        const pendingEntry = (id, idleMs, deliveries) => [id, "consumer", idleMs, deliveries];

        test("does nothing when nothing is pending", async () => {
            const { worker, cmd } = build();
            await expect(worker.reclaim()).resolves.toBe(0);
            expect(cmd.xpending).toHaveBeenCalledWith(STREAM, GROUP, "IDLE", "100", "-", "+", String(DEFAULTS.pendingScan));
        });

        test("paginates through pending entries using an exclusive cursor", async () => {
            const { worker, cmd } = build({ batch: 5, pendingScan: 2, maxAttempts: 1 });
            cmd.xpending
                .mockResolvedValueOnce([pendingEntry("1-0", 1, 1), pendingEntry("2-0", 1, 1)])
                .mockResolvedValueOnce([pendingEntry("3-0", 1, 1)])
                .mockResolvedValueOnce([]);
            cmd.xrange.mockResolvedValue([]);
            await expect(worker.reclaim()).resolves.toBe(3);
            expect(cmd.xpending).toHaveBeenNthCalledWith(1, STREAM, GROUP, "IDLE", "100", "-", "+", "2");
            expect(cmd.xpending).toHaveBeenNthCalledWith(2, STREAM, GROUP, "IDLE", "100", "(2-0", "+", "2");
            expect(cmd.xack).toHaveBeenCalledTimes(3);
        });

        test("skips a message that is still backing off", async () => {
            const { worker, cmd } = build({ handlers: { t: jest.fn() } });
            // after delivery 2 the required idle time is 100 * 2^1 = 200ms
            cmd.xpending.mockResolvedValue([pendingEntry("1-0", 150, 2)]);
            await expect(worker.reclaim()).resolves.toBe(0);
            expect(cmd.xclaim).not.toHaveBeenCalled();
        });

        test("claims an idle message with the backoff as min-idle and retries it with deliveries+1", async () => {
            const handler = jest.fn();
            const { worker, cmd } = build({ consumer: "c1", handlers: { t: handler } });
            cmd.xpending.mockResolvedValue([pendingEntry("1-0", 250, 2)]);
            cmd.xclaim.mockResolvedValueOnce([["1-0", flat({ type: "t", payload: '{"x":1}', key: "" })]]);

            await expect(worker.reclaim()).resolves.toBe(1);
            expect(cmd.xclaim).toHaveBeenCalledWith(STREAM, GROUP, "c1", "200", "1-0");
            expect(handler).toHaveBeenCalledWith({ x: 1 }, expect.objectContaining({ id: "1-0", deliveries: 3 }));
            expect(cmd.xack).toHaveBeenCalledWith(STREAM, GROUP, "1-0");
        });

        test("backoff grows exponentially and is capped by maxBackoffMs", async () => {
            const { worker, cmd } = build({ maxBackoffMs: 350, maxAttempts: 10, handlers: { t: jest.fn() } });
            const run = async (deliveries) => {
                cmd.xclaim.mockClear();
                cmd.xpending.mockResolvedValue([pendingEntry("1-0", 1_000_000, deliveries)]);
                await worker.reclaim();
                return cmd.xclaim.mock.calls[0][3];
            };
            expect(await run(1)).toBe("100");
            expect(await run(2)).toBe("200");
            expect(await run(3)).toBe("350"); // 400 capped
            expect(await run(8)).toBe("350");
        });

        test("skips a message another worker claimed first (empty XCLAIM result)", async () => {
            const handler = jest.fn();
            const { worker, cmd } = build({ handlers: { t: handler } });
            cmd.xpending.mockResolvedValue([pendingEntry("1-0", 500, 1)]);
            cmd.xclaim.mockResolvedValue([]);
            await expect(worker.reclaim()).resolves.toBe(0);
            expect(handler).not.toHaveBeenCalled();
        });

        test("a claimed entry whose body was trimmed is ACKed and logged as lost", async () => {
            const { worker, cmd, log } = build({ handlers: { t: jest.fn() } });
            cmd.xpending.mockResolvedValue([pendingEntry("1-0", 500, 1)]);
            cmd.xclaim.mockResolvedValue([["1-0", null]]);
            await worker.reclaim();
            expect(cmd.xack).toHaveBeenCalledWith(STREAM, GROUP, "1-0");
            expect(log.error).toHaveBeenCalledWith(
                "Stream message was trimmed before it was processed; it is lost", { stream: STREAM, id: "1-0" });
        });

        test("dead-letters a message that reached maxAttempts, reading it back with XRANGE", async () => {
            const { worker, cmd } = build({ maxAttempts: 3, handlers: { t: jest.fn() } });
            cmd.xpending.mockResolvedValue([pendingEntry("1-0", 1, 3)]);
            cmd.xrange.mockResolvedValue([["1-0", flat({ type: "t", payload: "{}", key: "" })]]);

            await expect(worker.reclaim()).resolves.toBe(1);
            expect(cmd.xrange).toHaveBeenCalledWith(STREAM, "1-0", "1-0");
            const args = cmd.xadd.mock.calls[0];
            expect(args[0]).toBe(`${STREAM}:dlq`);
            expect(args[args.indexOf("error") + 1]).toBe("gave up after 3 attempts");
            expect(cmd.xack).toHaveBeenCalledWith(STREAM, GROUP, "1-0");
            expect(cmd.xadd.mock.invocationCallOrder[0]).toBeLessThan(cmd.xack.mock.invocationCallOrder[0]);
            expect(cmd.xclaim).not.toHaveBeenCalled();
        });

        test("the DLQ reason is the last handler error when this process saw one", async () => {
            const { worker, cmd } = build({
                maxAttempts: 2, handlers: { t: jest.fn().mockRejectedValue(new Error("smtp 421")) },
            });
            deliver(cmd, [msg("1-0", "t")]);
            await worker.processNew(); // fails once, remembered in lastErrors

            cmd.xpending.mockResolvedValue([pendingEntry("1-0", 1, 2)]);
            cmd.xrange.mockResolvedValue([["1-0", flat({ type: "t", payload: "{}", key: "" })]]);
            await worker.reclaim();

            const args = cmd.xadd.mock.calls[0];
            expect(args[args.indexOf("error") + 1]).toBe("smtp 421");
        });

        test("an exhausted message that was already trimmed is ACKed and logged as lost", async () => {
            const { worker, cmd, log } = build({ maxAttempts: 2 });
            cmd.xpending.mockResolvedValue([pendingEntry("1-0", 1, 5)]);
            cmd.xrange.mockResolvedValue([]);
            await expect(worker.reclaim()).resolves.toBe(1);
            expect(cmd.xack).toHaveBeenCalledWith(STREAM, GROUP, "1-0");
            expect(cmd.xadd).not.toHaveBeenCalled();
            expect(log.error).toHaveBeenCalledWith(
                "Stream message was trimmed before it was processed; it is lost", { stream: STREAM, id: "1-0" });
        });

        test("handles at most `batch` messages per pass", async () => {
            const { worker, cmd } = build({ batch: 2, maxAttempts: 2 });
            cmd.xpending.mockResolvedValue([
                pendingEntry("1-0", 1, 9), pendingEntry("2-0", 1, 9), pendingEntry("3-0", 1, 9),
            ]);
            cmd.xrange.mockImplementation((_s, id) => Promise.resolve([[id, flat({ type: "t", payload: "{}" })]]));
            await expect(worker.reclaim()).resolves.toBe(2);
            expect(cmd.xrange).toHaveBeenCalledTimes(2);
        });
    });

    describe("trimAcked", () => {
        const groupsInfo = (lastDelivered) => [flat({ name: GROUP, "last-delivered-id": lastDelivered })];

        test("with nothing pending, trims everything already delivered", async () => {
            const { worker, cmd } = build();
            cmd.xinfo.mockResolvedValue(groupsInfo("50-0"));
            cmd.xpending.mockResolvedValue([0, null, null, null]);
            cmd.xtrim.mockResolvedValue(12);
            await expect(worker.trimAcked()).resolves.toBe(12);
            expect(cmd.xinfo).toHaveBeenCalledWith("GROUPS", STREAM);
            expect(cmd.xtrim).toHaveBeenCalledWith(STREAM, "MINID", "50-0");
        });

        test("with pending messages, trims only up to the oldest pending id", async () => {
            const { worker, cmd } = build();
            cmd.xinfo.mockResolvedValue(groupsInfo("50-0"));
            cmd.xpending.mockResolvedValue([3, "20-0", "40-0", [["c", "3"]]]);
            await worker.trimAcked();
            expect(cmd.xtrim).toHaveBeenCalledWith(STREAM, "MINID", "20-0");
        });

        test.each([["0-0"], [undefined]])("does not trim when nothing was ever delivered (%s)", async (last) => {
            const { worker, cmd } = build();
            cmd.xinfo.mockResolvedValue(last ? groupsInfo(last) : []);
            cmd.xpending.mockResolvedValue([0, null, null, null]);
            await expect(worker.trimAcked()).resolves.toBe(0);
            expect(cmd.xtrim).not.toHaveBeenCalled();
        });
    });

    describe("pruneConsumers", () => {
        const consumer = (name, pending, idle) => flat({ name, pending, idle });

        test("deletes idle consumers with no pending jobs, but never self or consumers that own pending jobs", async () => {
            const { worker, cmd } = build({ consumer: "me", consumerPruneIdleMs: 1000 });
            cmd.xinfo.mockResolvedValue([
                consumer("me", 0, 999_999),          // self: kept
                consumer("old-empty", 0, 5000),      // pruned
                consumer("old-busy", 2, 5000),       // owns pending jobs: kept
                consumer("recent", 0, 10),           // not idle long enough: kept
            ]);
            await worker.pruneConsumers();
            expect(cmd.xinfo).toHaveBeenCalledWith("CONSUMERS", STREAM, GROUP);
            expect(cmd.xgroup).toHaveBeenCalledTimes(1);
            expect(cmd.xgroup).toHaveBeenCalledWith("DELCONSUMER", STREAM, GROUP, "old-empty");
        });
    });

    describe("start / stop lifecycle", () => {
        const setupLoopMocks = ({ cmd, reader }) => {
            mockIdleLoopCommands(cmd);
            mockBlockingReads(reader);
        };

        test("start() creates the group, processes messages, and stop() shuts down cleanly", async () => {
            const handler = jest.fn();
            const { worker, cmd, reader, log } = build({ blockMs: 5, handlers: { t: handler }, consumer: "c1" });
            setupLoopMocks({ cmd, reader });
            reader.xreadgroup.mockImplementationOnce(() => Promise.resolve([[STREAM, [["1-0", flat({ type: "t", payload: '{"a":1}', key: "" })]]]]));

            const loop = worker.start();
            expect(worker.start()).toBe(loop); // idempotent
            await sleep(40);
            await worker.stop();

            expect(cmd.xgroup).toHaveBeenCalledWith("CREATE", STREAM, GROUP, "0", "MKSTREAM");
            expect(handler).toHaveBeenCalledWith({ a: 1 }, expect.objectContaining({ id: "1-0" }));
            expect(reader.disconnect).toHaveBeenCalled();
            expect(cmd.quit).toHaveBeenCalled();
            expect(log.info).toHaveBeenCalledWith("Stream worker started", { stream: STREAM, group: GROUP, consumer: "c1" });
            expect(log.info).toHaveBeenCalledWith("Stream worker stopped", { stream: STREAM, group: GROUP, consumer: "c1" });
        });

        test("stop() removes its own consumer when it has no pending jobs", async () => {
            const { worker, cmd, reader } = build({ blockMs: 5, consumer: "c1" });
            setupLoopMocks({ cmd, reader });
            cmd.xinfo.mockImplementation((what) =>
                Promise.resolve(what === "CONSUMERS" ? [flat({ name: "c1", pending: 0, idle: 1 })] : [flat({ name: GROUP, "last-delivered-id": "0-0" })]));
            worker.start();
            await sleep(20);
            await worker.stop();
            expect(cmd.xgroup).toHaveBeenCalledWith("DELCONSUMER", STREAM, GROUP, "c1");
        });

        test("stop() keeps its consumer when jobs are still pending for it", async () => {
            const { worker, cmd, reader } = build({ blockMs: 5, consumer: "c1" });
            setupLoopMocks({ cmd, reader });
            cmd.xinfo.mockImplementation((what) =>
                Promise.resolve(what === "CONSUMERS" ? [flat({ name: "c1", pending: 2, idle: 1 })] : [flat({ name: GROUP, "last-delivered-id": "0-0" })]));
            worker.start();
            await sleep(20);
            await worker.stop();
            expect(cmd.xgroup).not.toHaveBeenCalledWith("DELCONSUMER", expect.anything(), expect.anything(), "c1");
        });

        test("falls back to disconnect() when quit() fails during stop", async () => {
            const { worker, cmd, reader } = build({ blockMs: 5 });
            setupLoopMocks({ cmd, reader });
            cmd.quit.mockRejectedValue(new Error("closed"));
            worker.start();
            await sleep(15);
            await worker.stop();
            expect(cmd.disconnect).toHaveBeenCalled();
        });

        test("a failing loop iteration is logged and, after a 1s pause, the loop keeps running", async () => {
            const { worker, cmd, reader, log } = build({ blockMs: 5 });
            setupLoopMocks({ cmd, reader });
            reader.xreadgroup.mockRejectedValueOnce(new Error("LOADING"));
            worker.start();
            await sleep(50);
            expect(log.error).toHaveBeenCalledWith("Stream worker loop error", { stream: STREAM, group: GROUP, error: "LOADING" });
            expect(reader.xreadgroup).toHaveBeenCalledTimes(1); // still sleeping off the error
            await sleep(1_100);
            expect(reader.xreadgroup.mock.calls.length).toBeGreaterThan(1);
            await worker.stop();
        });

        describe("startup Redis configuration check", () => {
            const startAndStop = async (worker, cmd, reader) => {
                setupLoopMocks({ cmd, reader });
                worker.start();
                await sleep(15);
                await worker.stop();
            };

            test("is silent with noeviction + appendonly yes", async () => {
                const { worker, cmd, reader, log } = build({ blockMs: 5 });
                await startAndStop(worker, cmd, reader);
                expect(log.warn).not.toHaveBeenCalledWith(expect.stringMatching(/maxmemory-policy|appendonly/), expect.anything());
            });

            test("warns (outside production) about an eviction policy and AOF being off", async () => {
                const { worker, cmd, reader, log } = build({ blockMs: 5 });
                cmd.config.mockImplementation((_op, name) =>
                    Promise.resolve([name, name === "appendonly" ? "no" : "allkeys-lru"]));
                await startAndStop(worker, cmd, reader);
                expect(log.warn).toHaveBeenCalledWith(
                    expect.stringMatching(/maxmemory-policy is not 'noeviction'/), { stream: STREAM, policy: "allkeys-lru" });
                expect(log.warn).toHaveBeenCalledWith(
                    expect.stringMatching(/appendonly is off/), { stream: STREAM, appendonly: "no" });
            });

            test("a disabled CONFIG command only produces a warning", async () => {
                const { worker, cmd, reader, log } = build({ blockMs: 5 });
                cmd.config.mockRejectedValue(new Error("ERR unknown command 'CONFIG'"));
                await startAndStop(worker, cmd, reader);
                expect(log.warn).toHaveBeenCalledWith(
                    expect.stringMatching(/Could not verify Redis persistence settings/),
                    { stream: STREAM, error: expect.stringMatching(/CONFIG/) });
            });
        });

        describe("housekeeping", () => {
            test("logs an error with replay instructions while the DLQ is not empty", async () => {
                const { worker, cmd, reader, log } = build({ blockMs: 5 });
                setupLoopMocks({ cmd, reader });
                cmd.xlen.mockImplementation((s) => Promise.resolve(s.endsWith(":dlq") ? 3 : 10));
                worker.start();
                await sleep(25);
                await worker.stop();
                expect(log.error).toHaveBeenCalledWith(
                    "Dead-letter stream has messages that need attention",
                    expect.objectContaining({ stream: STREAM, deadLetters: 3, replay: `node tools/replayDlq.js ${STREAM}` }));
            });

            test("warns when too many jobs are un-acknowledged", async () => {
                const { worker, cmd, reader, log } = build({ blockMs: 5, pendingWarnAt: 5 });
                setupLoopMocks({ cmd, reader });
                cmd.xpending.mockImplementation((_s, _g, ...rest) => Promise.resolve(rest.length ? [] : [50, "1-0", "2-0", []]));
                worker.start();
                await sleep(25);
                await worker.stop();
                expect(log.warn).toHaveBeenCalledWith(
                    "Stream has many unacknowledged jobs", expect.objectContaining({ stream: STREAM, pending: 50 }));
            });

            test("a failing housekeeping task is logged and the other tasks still run", async () => {
                const { worker, cmd, reader, log } = build({ blockMs: 5 });
                setupLoopMocks({ cmd, reader });
                cmd.xinfo.mockImplementation((what) =>
                    what === "GROUPS" ? Promise.reject(new Error("xinfo failed")) : Promise.resolve([]));
                worker.start();
                await sleep(25);
                await worker.stop();
                expect(log.warn).toHaveBeenCalledWith(
                    "Stream housekeeping failed: trim", { stream: STREAM, error: "xinfo failed" });
                expect(cmd.xlen).toHaveBeenCalled(); // "report stats" still ran
            });
        });
    });
});

describe("getStreamStats", () => {
    test("returns length, pending count and dead-letter count", async () => {
        const client = makeClient();
        client.xlen.mockImplementation((s) => Promise.resolve(s === STREAM ? 7 : 2));
        client.xpending.mockResolvedValue([4, "1-0", "9-0", []]);
        await expect(getStreamStats(client, STREAM, GROUP)).resolves.toEqual({ length: 7, pending: 4, deadLetters: 2 });
        expect(client.xlen).toHaveBeenCalledWith(`${STREAM}:dlq`);
    });

    test("honours a custom DLQ stream name", async () => {
        const client = makeClient();
        await getStreamStats(client, STREAM, GROUP, "custom:dlq");
        expect(client.xlen).toHaveBeenCalledWith("custom:dlq");
    });

    test("reports zeros instead of throwing when the stream or group does not exist", async () => {
        const client = makeClient();
        client.xlen.mockRejectedValue(new Error("no such key"));
        client.xpending.mockRejectedValue(new Error("NOGROUP"));
        await expect(getStreamStats(client, STREAM, GROUP)).resolves.toEqual({ length: 0, pending: 0, deadLetters: 0 });
    });
});