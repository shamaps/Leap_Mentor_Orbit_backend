jest.mock("../../utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const AppError = require("../../utils/appError");
const { runWithTraceId } = require("../../utils/requestContext");
const { createInternalClient } = require("../../utils/internalClient");

const BASE = "http://payments-service:5004";
const TOKEN = "engagement-to-payments-secret";

/** A fetch Response double. `body` may be an object (JSON-encoded), a raw string, or "" (empty). */
const reply = (status, body = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
});

const makeClient = (overrides = {}) =>
    createInternalClient({
        caller: "engagement", target: "payments", baseUrl: BASE, token: TOKEN,
        retryDelayMs: 1, ...overrides,
    });

let realFetch;
beforeEach(() => {
    realFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue(reply(200, { success: true }));
});
afterEach(() => {
    global.fetch = realFetch;
});

const lastCall = () => {
    const [url, init] = global.fetch.mock.calls.at(-1);
    return { url, init };
};

describe("createInternalClient: construction", () => {
    test.each([
        [{ target: "payments" }],
        [{ caller: "engagement" }],
        [{}],
    ])("requires caller and target (%j)", (opts) => {
        expect(() => createInternalClient({ baseUrl: BASE, token: TOKEN, ...opts })).toThrow(/requires caller and target/);
    });

    test("exposes get/post/put/patch/delete", () => {
        const client = makeClient();
        for (const verb of ["get", "post", "put", "patch", "delete"]) expect(typeof client[verb]).toBe("function");
    });
});

describe("request construction", () => {
    test("sends the internal-auth headers and returns the parsed JSON body", async () => {
        const client = makeClient();
        global.fetch.mockResolvedValue(reply(200, { data: { balance: 5 } }));

        await expect(client.get("/internal/wallet/1")).resolves.toEqual({ data: { balance: 5 } });

        const { url, init } = lastCall();
        expect(url).toBe(`${BASE}/internal/wallet/1`);
        expect(init.method).toBe("GET");
        expect(init.headers).toMatchObject({
            Accept: "application/json",
            "X-Internal-Token": TOKEN,
            "X-Caller-Service": "engagement",
        });
        expect(init.headers["Content-Type"]).toBeUndefined();
        expect(init.body).toBeUndefined();
        expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    test("JSON-encodes the body and sets Content-Type", async () => {
        await makeClient().post("/internal/escrow", { body: { amount: 100 } });
        const { init } = lastCall();
        expect(init.method).toBe("POST");
        expect(init.body).toBe('{"amount":100}');
        expect(init.headers["Content-Type"]).toBe("application/json");
    });

    test("an explicitly falsy body (0, false, null) is still sent", async () => {
        await makeClient().post("/x", { body: null });
        expect(lastCall().init.body).toBe("null");
    });

    test.each([["put", "PUT"], ["patch", "PATCH"], ["delete", "DELETE"]])("%s uses the %s method", async (verb, method) => {
        await makeClient()[verb]("/x", { idempotencyKey: "k" });
        expect(lastCall().init.method).toBe(method);
    });

    test("strips a trailing slash from baseUrl and appends the query string", async () => {
        await makeClient({ baseUrl: `${BASE}/` }).get("/internal/list", { query: { page: 2, q: "a b" } });
        expect(lastCall().url).toBe(`${BASE}/internal/list?page=2&q=a+b`);
    });

    test("sends the Idempotency-Key header when provided", async () => {
        await makeClient().post("/x", { body: {}, idempotencyKey: "escrow-1" });
        expect(lastCall().init.headers["Idempotency-Key"]).toBe("escrow-1");
    });

    test("forwards the current trace id, but not the 'no-trace' placeholder", async () => {
        const client = makeClient();
        await runWithTraceId("trace-42", () => client.get("/x"));
        expect(lastCall().init.headers["X-Trace-Id"]).toBe("trace-42");

        await client.get("/x");
        expect(lastCall().init.headers["X-Trace-Id"]).toBeUndefined();
    });

    test("baseUrl and token may be functions, evaluated on every request", async () => {
        const baseUrl = jest.fn().mockReturnValueOnce("http://a:1").mockReturnValueOnce("http://b:2");
        const token = jest.fn().mockReturnValue("t");
        const client = makeClient({ baseUrl, token });
        await client.get("/x");
        await client.get("/x");
        expect(global.fetch.mock.calls[0][0]).toBe("http://a:1/x");
        expect(global.fetch.mock.calls[1][0]).toBe("http://b:2/x");
    });

    test("passes the per-attempt timeout to AbortSignal.timeout", async () => {
        const spy = jest.spyOn(AbortSignal, "timeout");
        await makeClient({ timeoutMs: 1234 }).get("/x");
        expect(spy).toHaveBeenCalledWith(1234);
    });
});

describe("configuration errors (no request is made)", () => {
    test("missing baseUrl -> 503 'not configured'", async () => {
        const err = await makeClient({ baseUrl: undefined }).get("/x").catch((e) => e);
        expect(err).toBeInstanceOf(AppError);
        expect(err).toMatchObject({ status: 503, message: "Payments service is not configured", meta: { upstream: "payments" } });
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test("missing token -> 503 'credentials are not configured'", async () => {
        const err = await makeClient({ token: () => "" }).get("/x").catch((e) => e);
        expect(err).toMatchObject({ status: 503, message: "Payments service credentials are not configured" });
        expect(global.fetch).not.toHaveBeenCalled();
    });
});

describe("responses", () => {
    test("an empty 2xx body resolves to null", async () => {
        global.fetch.mockResolvedValue(reply(204, ""));
        await expect(makeClient().delete("/x")).resolves.toBeNull();
    });

    test("a non-JSON 2xx body is wrapped as { message } and truncated to 200 chars", async () => {
        global.fetch.mockResolvedValue(reply(200, "x".repeat(500)));
        const out = await makeClient().get("/x");
        expect(out.message).toHaveLength(200);
    });

    test("4xx is thrown with the upstream status and message, and is never retried", async () => {
        global.fetch.mockResolvedValue(reply(422, { message: "Escrow already paid" }));
        const err = await makeClient().get("/x").catch((e) => e);
        expect(err).toBeInstanceOf(AppError);
        expect(err).toMatchObject({ status: 422, message: "Escrow already paid", meta: { upstream: "payments" } });
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test("4xx without a message falls back to a generic one", async () => {
        global.fetch.mockResolvedValue(reply(403, ""));
        await expect(makeClient().get("/x")).rejects.toMatchObject({ status: 403, message: "Payments service rejected the request" });
    });

    test("4xx errors keep the 4xx status so the stream worker dead-letters them", async () => {
        const { isPermanentFailure } = require("../../utils/streams");
        global.fetch.mockResolvedValue(reply(404, { message: "no such user" }));
        const err = await makeClient().get("/x").catch((e) => e);
        expect(isPermanentFailure(err)).toBe(true);
    });
});

describe("retries", () => {
    test("GET is retried on a 5xx and can recover", async () => {
        global.fetch.mockResolvedValueOnce(reply(503, "")).mockResolvedValueOnce(reply(200, { ok: 1 }));
        await expect(makeClient().get("/x")).resolves.toEqual({ ok: 1 });
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test("GET is retried on a network error", async () => {
        global.fetch.mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(reply(200, { ok: 1 }));
        await expect(makeClient().get("/x")).resolves.toEqual({ ok: 1 });
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test("1 + retries attempts in total, then a 5xx becomes a 502", async () => {
        global.fetch.mockResolvedValue(reply(500, ""));
        const err = await makeClient({ retries: 2 }).get("/x").catch((e) => e);
        expect(global.fetch).toHaveBeenCalledTimes(3);
        expect(err).toMatchObject({ status: 502, message: "Payments service returned an error", meta: { upstream: "payments" } });
    });

    test("retries: 0 means a single attempt", async () => {
        global.fetch.mockResolvedValue(reply(500, ""));
        await expect(makeClient({ retries: 0 }).get("/x")).rejects.toMatchObject({ status: 502 });
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test("POST without an idempotency key is never retried (it could double-charge)", async () => {
        global.fetch.mockResolvedValue(reply(500, ""));
        await expect(makeClient().post("/x", { body: {} })).rejects.toMatchObject({ status: 502 });
        expect(global.fetch).toHaveBeenCalledTimes(1);

        global.fetch.mockClear();
        global.fetch.mockRejectedValue(new TypeError("fetch failed"));
        await expect(makeClient().post("/x", { body: {} })).rejects.toMatchObject({ status: 503 });
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test("POST with an idempotency key IS retried", async () => {
        global.fetch.mockResolvedValueOnce(reply(502, "")).mockResolvedValueOnce(reply(201, { id: "e1" }));
        await expect(makeClient().post("/x", { body: {}, idempotencyKey: "k" })).resolves.toEqual({ id: "e1" });
        expect(global.fetch).toHaveBeenCalledTimes(2);
        for (const [, init] of global.fetch.mock.calls) expect(init.headers["Idempotency-Key"]).toBe("k");
    });

    test("a 4xx in the middle of retries stops immediately", async () => {
        global.fetch.mockResolvedValueOnce(reply(500, "")).mockResolvedValueOnce(reply(400, { message: "bad" }));
        await expect(makeClient().get("/x")).rejects.toMatchObject({ status: 400, message: "bad" });
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test("waits retryDelayMs * attempt between attempts", async () => {
        jest.useFakeTimers();
        try {
            global.fetch.mockResolvedValue(reply(500, ""));
            const p = makeClient({ retries: 2, retryDelayMs: 100 }).get("/x");
            const assertion = expect(p).rejects.toMatchObject({ status: 502 });

            await jest.advanceTimersByTimeAsync(0);
            expect(global.fetch).toHaveBeenCalledTimes(1);
            await jest.advanceTimersByTimeAsync(99);
            expect(global.fetch).toHaveBeenCalledTimes(1);
            await jest.advanceTimersByTimeAsync(1);   // after 100ms
            expect(global.fetch).toHaveBeenCalledTimes(2);
            await jest.advanceTimersByTimeAsync(199);
            expect(global.fetch).toHaveBeenCalledTimes(2);
            await jest.advanceTimersByTimeAsync(1);   // after a further 200ms
            expect(global.fetch).toHaveBeenCalledTimes(3);
            await assertion;
        } finally {
            jest.useRealTimers();
        }
    });
});

describe("network failures", () => {
    test("a timeout becomes a 504", async () => {
        global.fetch.mockRejectedValue(Object.assign(new Error("The operation was aborted"), { name: "TimeoutError" }));
        await expect(makeClient({ retries: 0 }).get("/x")).rejects.toMatchObject({
            status: 504, message: "Payments service timed out", meta: { upstream: "payments" },
        });
    });

    test("an AbortError is also treated as a timeout", async () => {
        global.fetch.mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
        await expect(makeClient({ retries: 0 }).get("/x")).rejects.toMatchObject({ status: 504 });
    });

    test("any other network error becomes a 503", async () => {
        global.fetch.mockRejectedValue(new TypeError("fetch failed"));
        await expect(makeClient({ retries: 0 }).get("/x")).rejects.toMatchObject({
            status: 503, message: "Payments service is unavailable",
        });
    });

    test("the target name in messages is title-cased", async () => {
        global.fetch.mockRejectedValue(new TypeError("fetch failed"));
        const client = createInternalClient({ caller: "identity", target: "catalog", baseUrl: BASE, token: TOKEN, retries: 0 });
        await expect(client.get("/x")).rejects.toMatchObject({ message: "Catalog service is unavailable", meta: { upstream: "catalog" } });
    });
});
