jest.mock("../../utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock("mongoose", () => ({ connection: { close: jest.fn().mockResolvedValue(undefined) } }));

const mongoose = require("mongoose");
const logger = require("../../utils/logger");
const { registerGracefulShutdown } = require("../../utils/gracefulShutdown");

let exitSpy;
let onSpy;
beforeEach(() => {
    exitSpy = jest.spyOn(process, "exit").mockImplementation(() => undefined);
    onSpy = jest.spyOn(process, "on").mockImplementation(() => process); // don't register real signal handlers
});
afterEach(() => jest.useRealTimers());

/** A closeServer whose callback result (a promise) can be awaited by the test. */
const makeCloser = () => {
    const state = { done: undefined };
    const closeServer = jest.fn((cb) => { state.done = cb(); });
    return { closeServer, finished: () => state.done };
};

describe("registerGracefulShutdown: validation", () => {
    test("requires a name", () => {
        expect(() => registerGracefulShutdown({ server: {} })).toThrow(/'name' is required/);
        expect(() => registerGracefulShutdown()).toThrow(/'name' is required/);
    });

    test("requires a server or a closeServer", () => {
        expect(() => registerGracefulShutdown({ name: "identity" })).toThrow(/pass 'server' or 'closeServer'/);
    });
});

describe("registerGracefulShutdown: behaviour", () => {
    test("registers SIGTERM and SIGINT handlers", () => {
        registerGracefulShutdown({ name: "identity", server: { close: jest.fn() } });
        expect(onSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
        expect(onSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    });

    test("the registered signal handlers trigger the shutdown", async () => {
        const { closeServer, finished } = makeCloser();
        registerGracefulShutdown({ name: "identity", closeServer });
        const sigterm = onSpy.mock.calls.find(([sig]) => sig === "SIGTERM")[1];
        sigterm();
        await finished();
        expect(closeServer).toHaveBeenCalledTimes(1);
        expect(logger.info).toHaveBeenCalledWith("identity: SIGTERM received, shutting down");
    });

    test("stops accepting requests, closes MongoDB, then exits 0", async () => {
        const order = [];
        const server = { close: jest.fn((cb) => { order.push("server.close"); cb(); }) };
        mongoose.connection.close.mockImplementation(async () => { order.push("mongo.close"); });
        exitSpy.mockImplementation((code) => { order.push(`exit(${code})`); });

        const shutdown = registerGracefulShutdown({ name: "identity", server });
        shutdown("SIGTERM");
        await new Promise((r) => setImmediate(r));

        expect(order).toEqual(["server.close", "mongo.close", "exit(0)"]);
    });

    test("prefers a custom closeServer over server.close", async () => {
        const server = { close: jest.fn() };
        const { closeServer, finished } = makeCloser();
        const shutdown = registerGracefulShutdown({ name: "communication", server, closeServer });
        shutdown("SIGINT");
        await finished();
        expect(closeServer).toHaveBeenCalledTimes(1);
        expect(server.close).not.toHaveBeenCalled();
    });

    test("is idempotent: a second signal does not start a second shutdown", async () => {
        const { closeServer, finished } = makeCloser();
        const shutdown = registerGracefulShutdown({ name: "identity", closeServer });
        shutdown("SIGTERM");
        shutdown("SIGINT");
        await finished();
        expect(closeServer).toHaveBeenCalledTimes(1);
        expect(mongoose.connection.close).toHaveBeenCalledTimes(1);
    });

    test("a MongoDB close error is logged but the process still exits 0", async () => {
        mongoose.connection.close.mockRejectedValue(new Error("already closed"));
        const { closeServer, finished } = makeCloser();
        registerGracefulShutdown({ name: "identity", closeServer })("SIGTERM");
        await finished();
        expect(logger.error).toHaveBeenCalledWith("identity: error closing MongoDB", { error: "already closed" });
        expect(exitSpy).toHaveBeenCalledWith(0);
    });

    test("force-exits with code 1 if in-flight requests never finish within timeoutMs", () => {
        jest.useFakeTimers();
        registerGracefulShutdown({ name: "identity", closeServer: jest.fn(), timeoutMs: 5000 })("SIGTERM");
        jest.advanceTimersByTime(4999);
        expect(exitSpy).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test("the force-exit timer is unref'd so it cannot keep the process alive by itself", () => {
        const unref = jest.fn();
        const timerSpy = jest.spyOn(global, "setTimeout").mockReturnValue({ unref });
        registerGracefulShutdown({ name: "identity", closeServer: jest.fn() })("SIGTERM");
        expect(timerSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
        expect(unref).toHaveBeenCalled();
    });
});
