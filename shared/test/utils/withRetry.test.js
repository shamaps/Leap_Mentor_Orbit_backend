jest.mock("../../utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const logger = require("../../utils/logger");
const { withRetry } = require("../../utils/withRetry");

// Tiny delays keep real timers fast; jitter is random in [0, cap).
const fast = { baseDelayMs: 1, maxDelayMs: 2 };
const transient = (code = "ECONNRESET") => Object.assign(new Error(`transient ${code}`), { code });

describe("withRetry", () => {
    test("returns the result without retrying when the first attempt succeeds", async () => {
        const fn = jest.fn().mockResolvedValue("ok");
        await expect(withRetry(fn, fast)).resolves.toBe("ok");
        expect(fn).toHaveBeenCalledTimes(1);
        expect(logger.warn).not.toHaveBeenCalled();
    });

    test("retries a transient failure and then succeeds", async () => {
        const fn = jest.fn().mockRejectedValueOnce(transient()).mockResolvedValueOnce("ok");
        await expect(withRetry(fn, { ...fast, label: "upload" })).resolves.toBe("ok");
        expect(fn).toHaveBeenCalledTimes(2);
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringMatching(/^\[upload\] attempt 1\/3 failed/),
            expect.objectContaining({ attempt: 1, error: "transient ECONNRESET" }));
    });

    test("gives up after `retries` attempts and throws the last error", async () => {
        const fn = jest.fn()
            .mockRejectedValueOnce(transient("ETIMEDOUT"))
            .mockRejectedValueOnce(transient("ECONNRESET"))
            .mockRejectedValueOnce(transient("ENOTFOUND"));
        await expect(withRetry(fn, { ...fast, retries: 3, label: "x" })).rejects.toThrow("transient ENOTFOUND");
        expect(fn).toHaveBeenCalledTimes(3);
        expect(logger.error).toHaveBeenCalledWith("[x] all 3 attempts failed", { error: "transient ENOTFOUND" });
    });

    test("does not retry a non-retryable error", async () => {
        const err = Object.assign(new Error("bad request"), { status: 400 });
        const fn = jest.fn().mockRejectedValue(err);
        await expect(withRetry(fn, fast)).rejects.toBe(err);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test("retries: 1 means a single attempt", async () => {
        const fn = jest.fn().mockRejectedValue(transient());
        await expect(withRetry(fn, { ...fast, retries: 1 })).rejects.toThrow();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    describe("default retryable classification", () => {
        test.each([
            ["gateway timeout status", { status: 504 }],
            ["http_code 429", { http_code: 429 }],
            ["response.status 429", { response: { status: 429 } }],
            ["numeric code 500", { code: 500 }],
            ["http_code 503", { http_code: 503 }],
            ["ETIMEDOUT", { code: "ETIMEDOUT" }],
            ["ECONNRESET", { code: "ECONNRESET" }],
            ["ECONNREFUSED", { code: "ECONNREFUSED" }],
            ["ENOTFOUND", { code: "ENOTFOUND" }],
        ])("retries on %s", async (_name, props) => {
            const fn = jest.fn().mockRejectedValueOnce(Object.assign(new Error("x"), props)).mockResolvedValueOnce("ok");
            await expect(withRetry(fn, fast)).resolves.toBe("ok");
            expect(fn).toHaveBeenCalledTimes(2);
        });

        test.each([
            ["status 400", { status: 400 }],
            ["status 404", { status: 404 }],
            ["http_code 401", { http_code: 401 }],
            ["unknown string code", { code: "EACCES" }],
            ["plain error", {}],
        ])("does not retry on %s", async (_name, props) => {
            const fn = jest.fn().mockRejectedValue(Object.assign(new Error("x"), props));
            await expect(withRetry(fn, fast)).rejects.toThrow("x");
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    test("a custom isRetryable overrides the default", async () => {
        const fn = jest.fn().mockRejectedValueOnce(new Error("flaky")).mockResolvedValueOnce("ok");
        const isRetryable = jest.fn().mockReturnValue(true);
        await expect(withRetry(fn, { ...fast, isRetryable })).resolves.toBe("ok");
        expect(isRetryable).toHaveBeenCalledWith(expect.objectContaining({ message: "flaky" }));
    });

    test("a custom isRetryable can also forbid retrying an error the default would retry", async () => {
        const fn = jest.fn().mockRejectedValue(transient());
        await expect(withRetry(fn, { ...fast, isRetryable: () => false })).rejects.toThrow();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    describe("backoff", () => {
        afterEach(() => jest.useRealTimers());

        test("delay is full-jitter: random() * min(maxDelay, base * 2^(attempt-1))", async () => {
            jest.useFakeTimers();
            jest.spyOn(Math, "random").mockReturnValue(0.5);
            const fn = jest.fn().mockRejectedValue(transient());

            const p = withRetry(fn, { retries: 3, baseDelayMs: 100, maxDelayMs: 10_000 });
            const assertion = expect(p).rejects.toThrow();

            await jest.advanceTimersByTimeAsync(0);
            expect(fn).toHaveBeenCalledTimes(1);
            // attempt 1: floor(0.5 * 100) = 50ms
            await jest.advanceTimersByTimeAsync(49);
            expect(fn).toHaveBeenCalledTimes(1);
            await jest.advanceTimersByTimeAsync(1);
            expect(fn).toHaveBeenCalledTimes(2);
            // attempt 2: floor(0.5 * 200) = 100ms
            await jest.advanceTimersByTimeAsync(99);
            expect(fn).toHaveBeenCalledTimes(2);
            await jest.advanceTimersByTimeAsync(1);
            expect(fn).toHaveBeenCalledTimes(3);
            await assertion;
        });

        test("delay is capped by maxDelayMs", async () => {
            jest.useFakeTimers();
            jest.spyOn(Math, "random").mockReturnValue(0.999);
            const fn = jest.fn().mockRejectedValue(transient());
            const p = withRetry(fn, { retries: 2, baseDelayMs: 1_000_000, maxDelayMs: 100 });
            const assertion = expect(p).rejects.toThrow();
            await jest.advanceTimersByTimeAsync(99); // floor(0.999 * 100) = 99
            expect(fn).toHaveBeenCalledTimes(2);
            await assertion;
        });
    });
});
