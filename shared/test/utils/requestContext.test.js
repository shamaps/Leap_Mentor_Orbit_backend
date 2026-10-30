const { getTraceId, runWithTraceId } = require("../../utils/requestContext");

describe("requestContext", () => {
    test("getTraceId returns 'no-trace' outside any context", () => {
        expect(getTraceId()).toBe("no-trace");
    });

    test("runWithTraceId exposes the id to the callback and returns its result", () => {
        expect(runWithTraceId("abc", () => getTraceId())).toBe("abc");
    });

    test("the id survives awaits and timers", async () => {
        const seen = await runWithTraceId("t-1", async () => {
            await Promise.resolve();
            await new Promise((r) => setTimeout(r, 5));
            return getTraceId();
        });
        expect(seen).toBe("t-1");
    });

    test("the id does not leak out of the callback", () => {
        runWithTraceId("inner", () => undefined);
        expect(getTraceId()).toBe("no-trace");
    });

    test("concurrent contexts stay isolated", async () => {
        const run = (id, delay) => runWithTraceId(id, async () => {
            await new Promise((r) => setTimeout(r, delay));
            return getTraceId();
        });
        await expect(Promise.all([run("A", 20), run("B", 5), run("C", 10)])).resolves.toEqual(["A", "B", "C"]);
    });

    test("nested contexts shadow and then restore the outer id", () => {
        runWithTraceId("outer", () => {
            expect(runWithTraceId("inner", () => getTraceId())).toBe("inner");
            expect(getTraceId()).toBe("outer");
        });
    });
});
