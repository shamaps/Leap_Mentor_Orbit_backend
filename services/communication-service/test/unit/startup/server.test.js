/**
 * @fileoverview Startup wiring tests for the Communication service entrypoint (server.js).
 * Every collaborator is mocked, so nothing connects to a database or opens a port.
 */

const http = require("node:http");

// ── state recorded by the mocks ───────────────────────────────
const mockOrder = [];
let mockListenPort;
let mockServerArgs;
let mockIoUseArgs;
let mockGracefulArgs;
let mockCreatedWith;
let mockStopImpl;

const mockApp = { isApp: true };
const mockHttpServer = {
    listen: (port, callback) => {
        mockOrder.push("listen");
        mockListenPort = port;
        if (callback) callback();
        return mockHttpServer;
    },
};
const mockIo = {
    use: (fn) => { mockOrder.push("io.use"); mockIoUseArgs.push(fn); },
    close: (callback) => { mockOrder.push("io.close"); if (callback) callback(); },
};
const mockEmailWorker = { stop: () => mockStopImpl() };
const mockSocketAuth = () => { };
const mockSocketHandlerSpy = jest.fn();
let mockNotificationStopImpl;
const mockNotificationWorker = { stop: () => mockNotificationStopImpl() };
// Shared objects, so assertions see the same instances server.js gets even though it is loaded
// through jest.isolateModules (which re-runs mock factories inside its own registry).
const mockSentry = { captureException: jest.fn() };
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

jest.mock("@leapmentor/shared/instrument", () => ({}));
jest.mock("dotenv", () => ({ config: jest.fn() }));
jest.mock("@sentry/node", () => mockSentry);
jest.mock("@leapmentor/shared/utils/logger", () => mockLogger);
jest.mock("@leapmentor/shared/utils/gracefulShutdown", () => ({
    registerGracefulShutdown: (options) => { mockOrder.push("registerGracefulShutdown"); mockGracefulArgs = options; },
}));
jest.mock("@leapmentor/shared/config/database", () => ({
    connectDB: async () => { mockOrder.push("connectDB"); },
}));
jest.mock("socket.io", () => ({
    Server: function MockServer(...args) { mockOrder.push("new Server"); mockServerArgs = args; return mockIo; },
}));
jest.mock("../../../src/app", () => mockApp);
jest.mock("../../../src/socket/socketAuth", () => mockSocketAuth);
jest.mock("../../../src/socket/socketHandler", () => (io) => { mockOrder.push("socketHandler"); mockSocketHandlerSpy(io); });
jest.mock("../../../src/cron/sessionReminders", () => ({
    startSessionReminderCron: () => { mockOrder.push("startSessionReminderCron"); },
}));
jest.mock("../../../src/workers/emailWorker", () => ({
    startEmailWorker: () => { mockOrder.push("startEmailWorker"); return mockEmailWorker; },
}));
jest.mock("../../../src/workers/notificationWorker", () => ({
    startNotificationWorker: () => { mockOrder.push("startNotificationWorker"); return mockNotificationWorker; },
}));
let processHandlers;
let savedEnv;

// Loads server.js fresh and waits for its async start-up to finish.
const startServer = async () => {
    jest.isolateModules(() => {
        require("../../../src/server");
    });
    await new Promise((resolve) => setImmediate(resolve));
};

beforeEach(() => {
    mockOrder.length = 0;
    mockListenPort = undefined;
    mockServerArgs = undefined;
    mockIoUseArgs = [];
    mockGracefulArgs = undefined;
    mockCreatedWith = undefined;
    mockStopImpl = async () => { mockOrder.push("worker.stop"); };
    mockNotificationStopImpl = async () => { mockOrder.push("notificationWorker.stop"); };
    processHandlers = {};

    savedEnv = { PORT: process.env.PORT, SOCKET_CORS_ORIGINS: process.env.SOCKET_CORS_ORIGINS };
    delete process.env.PORT;
    delete process.env.SOCKET_CORS_ORIGINS;

    jest.spyOn(http, "createServer").mockImplementation((app) => {
        mockOrder.push("createServer");
        mockCreatedWith = app;
        return mockHttpServer;
    });
    jest.spyOn(process, "on").mockImplementation((event, handler) => {
        processHandlers[event] = handler;
        return process;
    });
    jest.spyOn(process, "exit").mockImplementation(() => undefined);
});

afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
});

describe("Communication server start-up", () => {
    it("should connect to the database first, then start the cron, worker, sockets and listener in order", async () => {
        await startServer();

        expect(mockOrder).toEqual([
            "connectDB",
            "startSessionReminderCron",
            "startEmailWorker",
            "createServer",
            "new Server",
            "io.use",
            "socketHandler",
            "startNotificationWorker",
            "listen",
            "registerGracefulShutdown",
        ]);
    });

    it("should build the HTTP server from the Express app", async () => {
        await startServer();

        expect(mockCreatedWith).toBe(mockApp);
    });

    describe("Socket.IO", () => {
        it("should attach the Socket.IO server to the HTTP server with the expected ping settings", async () => {
            await startServer();

            const [server, options] = mockServerArgs;
            expect(server).toBe(mockHttpServer);
            expect(options).toMatchObject({ pingTimeout: 60000, pingInterval: 25000 });
            expect(options.cors.credentials).toBe(true);
        });

        it("should take the allowed socket origins from SOCKET_CORS_ORIGINS, trimmed", async () => {
            process.env.SOCKET_CORS_ORIGINS = "https://a.example.com, https://b.example.com";

            await startServer();

            expect(mockServerArgs[1].cors.origin).toEqual(["https://a.example.com", "https://b.example.com"]);
        });

        it("should allow no socket origins when SOCKET_CORS_ORIGINS is not set", async () => {
            await startServer();

            expect(mockServerArgs[1].cors.origin).toEqual([]);
        });

        it("should authenticate every handshake with socketAuth and hand the server to socketHandler", async () => {
            await startServer();

            expect(mockIoUseArgs).toEqual([mockSocketAuth]);
            expect(mockSocketHandlerSpy).toHaveBeenCalledWith(mockIo);
        });
    });

    describe("listening", () => {
        it("should listen on PORT when it is set", async () => {
            process.env.PORT = "6100";

            await startServer();

            expect(mockListenPort).toBe("6100");
            expect(mockLogger.info).toHaveBeenCalledWith("communication service listening on port 6100");
        });

        it("should default to port 5000", async () => {
            await startServer();

            expect(mockListenPort).toBe(5000);
            expect(mockLogger.info).toHaveBeenCalledWith("communication service listening on port 5000");
        });
    });

    describe("graceful shutdown", () => {
        it("should register shutdown handling for the HTTP server", async () => {
            await startServer();

            expect(mockGracefulArgs.name).toBe("communication");
            expect(mockGracefulArgs.server).toBe(mockHttpServer);
            expect(typeof mockGracefulArgs.closeServer).toBe("function");
        });

        it("should stop both workers before closing the socket server", async () => {
            await startServer();
            mockOrder.length = 0;
            const done = jest.fn();

            mockGracefulArgs.closeServer(done);
            await new Promise((resolve) => setImmediate(resolve));

            expect(mockOrder).toEqual(["worker.stop", "notificationWorker.stop", "io.close"]);
            expect(done).toHaveBeenCalledTimes(1);
        });

        it("should still close the socket server when stopping the email worker fails", async () => {
            await startServer();
            mockOrder.length = 0;
            mockStopImpl = async () => { throw new Error("worker stuck"); };
            const done = jest.fn();

            mockGracefulArgs.closeServer(done);
            await new Promise((resolve) => setImmediate(resolve));

            expect(mockOrder).toEqual(["notificationWorker.stop", "io.close"]);
            expect(done).toHaveBeenCalledTimes(1);
        });

        it("should still close the socket server when stopping the notification worker fails", async () => {
            await startServer();
            mockOrder.length = 0;
            mockNotificationStopImpl = async () => { throw new Error("worker stuck"); };
            const done = jest.fn();

            mockGracefulArgs.closeServer(done);
            await new Promise((resolve) => setImmediate(resolve));

            expect(mockOrder).toEqual(["worker.stop", "io.close"]);
            expect(done).toHaveBeenCalledTimes(1);
        });
    });

    describe("process-level error handlers", () => {
        it("should register handlers for unhandled rejections and uncaught exceptions", async () => {
            await startServer();

            expect(typeof processHandlers.unhandledRejection).toBe("function");
            expect(typeof processHandlers.uncaughtException).toBe("function");
        });

        it("should report an unhandled rejection to Sentry and the log without exiting", async () => {
            await startServer();
            const reason = new Error("boom");

            processHandlers.unhandledRejection(reason);

            expect(mockSentry.captureException).toHaveBeenCalledWith(reason);
            expect(mockLogger.error).toHaveBeenCalledWith(
                "Unhandled Promise Rejection",
                { reason: "boom", stack: reason.stack }
            );
            expect(process.exit).not.toHaveBeenCalled();
        });

        it("should log a rejection reason that is not an Error as-is", async () => {
            await startServer();

            processHandlers.unhandledRejection("just a string");

            expect(mockLogger.error).toHaveBeenCalledWith(
                "Unhandled Promise Rejection",
                expect.objectContaining({ reason: "just a string" })
            );
        });

        it("should exit the process after an uncaught programming error", async () => {
            await startServer();
            const err = new Error("bug");

            processHandlers.uncaughtException(err);

            expect(mockSentry.captureException).toHaveBeenCalledWith(err);
            expect(mockLogger.error).toHaveBeenCalledWith("Uncaught Exception", { error: "bug", stack: err.stack });
            expect(process.exit).toHaveBeenCalledWith(1);
        });

        it("should keep running after an uncaught operational error", async () => {
            await startServer();
            const err = Object.assign(new Error("expected failure"), { isOperational: true });

            processHandlers.uncaughtException(err);

            expect(mockSentry.captureException).toHaveBeenCalledWith(err);
            expect(process.exit).not.toHaveBeenCalled();
        });
    });
});