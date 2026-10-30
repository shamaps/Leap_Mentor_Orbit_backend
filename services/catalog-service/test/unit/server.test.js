/**
 * @fileoverview Startup tests for the Catalog service entry point. Every dependency is mocked;
 * the file is loaded in isolation so the startup sequence can be observed.
 */

const flush = () => new Promise((resolve) => setImmediate(resolve));

const mockSentry = { captureException: jest.fn() };
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
const mockConnectDB = jest.fn();
const mockStartCleanupCron = jest.fn();
const mockRegisterGracefulShutdown = jest.fn();
const mockListen = jest.fn();
const mockCreateServer = jest.fn();
const mockServer = { listen: (...args) => mockListen(...args) };

jest.mock("@leapmentor/shared/instrument", () => ({}));
jest.mock("dotenv", () => ({ config: jest.fn() }));
jest.mock("@sentry/node", () => mockSentry);
jest.mock("@leapmentor/shared/utils/logger", () => mockLogger);
jest.mock("@leapmentor/shared/utils/gracefulShutdown", () => ({
    registerGracefulShutdown: (...args) => mockRegisterGracefulShutdown(...args),
}));
jest.mock("@leapmentor/shared/config/database", () => ({ connectDB: (...args) => mockConnectDB(...args) }));
jest.mock("../../src/app", () => "mock-express-app");
jest.mock("../../src/cron/cleanupAvailability", () => ({ startCleanupCron: (...args) => mockStartCleanupCron(...args) }));
jest.mock("node:http", () => ({ createServer: (...args) => mockCreateServer(...args) }));

let processHandlers;
let previousPort;

const boot = async () => {
    jest.isolateModules(() => {
        require("../../src/server");
    });
    await flush();
};

beforeEach(() => {
    processHandlers = {};
    previousPort = process.env.PORT;
    delete process.env.PORT;

    jest.spyOn(process, "on").mockImplementation((event, handler) => {
        processHandlers[event] = handler;
        return process;
    });
    jest.spyOn(process, "exit").mockImplementation(() => undefined);

    mockConnectDB.mockResolvedValue(undefined);
    mockListen.mockImplementation((port, cb) => { cb?.(); return mockServer; });
    mockCreateServer.mockReturnValue(mockServer);
});

afterEach(() => {
    if (previousPort === undefined) delete process.env.PORT;
    else process.env.PORT = previousPort;
});

describe("Catalog server startup", () => {
    it("should connect to the database before starting the cron and listening", async () => {
        const order = [];
        mockConnectDB.mockImplementation(async () => { order.push("db"); });
        mockStartCleanupCron.mockImplementation(() => order.push("cron"));
        mockListen.mockImplementation((port, cb) => { order.push("listen"); cb?.(); return mockServer; });

        await boot();

        expect(order).toEqual(["db", "cron", "listen"]);
    });

    it("should serve the express app on port 5000 by default", async () => {
        await boot();

        expect(mockCreateServer).toHaveBeenCalledWith("mock-express-app");
        expect(mockListen).toHaveBeenCalledWith(5000, expect.any(Function));
        expect(mockLogger.info).toHaveBeenCalledWith("catalog service listening on port 5000");
    });

    it("should use the PORT environment variable when set", async () => {
        process.env.PORT = "7001";

        await boot();

        expect(mockListen).toHaveBeenCalledWith("7001", expect.any(Function));
        expect(mockLogger.info).toHaveBeenCalledWith("catalog service listening on port 7001");
    });

    it("should register graceful shutdown for the running server", async () => {
        await boot();

        expect(mockRegisterGracefulShutdown).toHaveBeenCalledWith({ name: "catalog", server: mockServer });
    });

    it("should not start the cron or listen until the database connection has completed", async () => {
        let finishConnecting;
        mockConnectDB.mockReturnValue(new Promise((resolve) => { finishConnecting = resolve; }));

        await boot();

        expect(mockStartCleanupCron).not.toHaveBeenCalled();
        expect(mockListen).not.toHaveBeenCalled();

        finishConnecting();
        await flush();

        expect(mockStartCleanupCron).toHaveBeenCalledTimes(1);
        expect(mockListen).toHaveBeenCalledTimes(1);
    });

    describe("process-level error handlers", () => {
        it("should register handlers for unhandled rejections and uncaught exceptions", async () => {
            await boot();

            expect(processHandlers.unhandledRejection).toEqual(expect.any(Function));
            expect(processHandlers.uncaughtException).toEqual(expect.any(Function));
        });

        it("should report an unhandled rejection to Sentry and the log without exiting", async () => {
            await boot();
            const reason = new Error("promise failed");

            processHandlers.unhandledRejection(reason);

            expect(mockSentry.captureException).toHaveBeenCalledWith(reason);
            expect(mockLogger.error).toHaveBeenCalledWith(
                "Unhandled Promise Rejection",
                { reason: "promise failed", stack: reason.stack }
            );
            expect(process.exit).not.toHaveBeenCalled();
        });

        it("should log a non-Error rejection reason as-is", async () => {
            await boot();

            processHandlers.unhandledRejection("plain string");

            expect(mockLogger.error).toHaveBeenCalledWith(
                "Unhandled Promise Rejection",
                { reason: "plain string", stack: undefined }
            );
        });

        it("should exit with code 1 after an uncaught programming error", async () => {
            await boot();
            const err = new Error("bug");

            processHandlers.uncaughtException(err);

            expect(mockSentry.captureException).toHaveBeenCalledWith(err);
            expect(mockLogger.error).toHaveBeenCalledWith("Uncaught Exception", { error: "bug", stack: err.stack });
            expect(process.exit).toHaveBeenCalledWith(1);
        });

        it("should keep running after an uncaught operational error", async () => {
            await boot();
            const err = Object.assign(new Error("expected failure"), { isOperational: true });

            processHandlers.uncaughtException(err);

            expect(mockSentry.captureException).toHaveBeenCalledWith(err);
            expect(process.exit).not.toHaveBeenCalled();
        });
    });
});
