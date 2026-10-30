const AppError = require("../../utils/appError");
const { withTimeout } = require("../../utils/withTimeout");

jest.mock("../../utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

describe("withTimeout", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test("resolves with the promise's value when it finishes in time", async () => {
        await expect(withTimeout(Promise.resolve("done"), 1000, "job")).resolves.toBe("done");
    });

    test("propagates the promise's own rejection", async () => {
        await expect(withTimeout(Promise.reject(new Error("boom")), 1000, "job")).rejects.toThrow("boom");
    });

    test("rejects with a 504 AppError naming the operation when it is too slow", async () => {
        const p = withTimeout(new Promise(() => { }), 500, "Cloudinary upload");
        const assertion = expect(p).rejects.toMatchObject({
            status: 504, message: "Cloudinary upload timed out", isOperational: true,
        });
        await jest.advanceTimersByTimeAsync(500);
        await assertion;
        await expect(p).rejects.toBeInstanceOf(AppError);
    });

    test("does not time out just before the deadline", async () => {
        let settled = false;
        const p = withTimeout(new Promise((resolve) => setTimeout(() => resolve("late"), 400)), 500, "job")
            .then((v) => { settled = true; return v; });
        await jest.advanceTimersByTimeAsync(399);
        expect(settled).toBe(false);
        await jest.advanceTimersByTimeAsync(1);
        await expect(p).resolves.toBe("late");
    });
});
