// server.js starts everything from an async IIFE at require time, so each test
// loads it fresh (jest.resetModules) with every collaborator mocked.
const mockOrder = [];
const mockServer = { close: jest.fn((cb) => cb && cb()) };
const mockListen = jest.fn(() => mockServer);
const mockCreateServer = jest.fn(() => ({ listen: mockListen }));
const mockWorker = { stop: jest.fn() };
const mockApp = { name: "express-app" };
const mockUserCascade = { handlers: {} };

jest.mock("@leapmentor/shared/instrument", () => { mockOrder.push("instrument"); return {}; });
jest.mock("dotenv", () => ({ config: jest.fn(() => { mockOrder.push("dotenv"); }) }));
jest.mock("node:http", () => ({ createServer: (...args) => mockCreateServer(...args) }));
jest.mock("@sentry/node", () => ({ captureException: jest.fn() }));
jest.mock("@leapmentor/shared/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("@leapmentor/shared/utils/gracefulShutdown", () => ({ registerGracefulShutdown: jest.fn() }));
jest.mock("@leapmentor/shared/config/database", () => ({ connectDB: jest.fn() }));
jest.mock("../../src/app", () => { mockOrder.push("app"); return mockApp; });
jest.mock("../../src/config/container", () => ({ userCascade: mockUserCascade }));
jest.mock("../../src/workers/userCascadeWorker", () => ({ startUserCascadeWorker: jest.fn() }));

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("Identity Server Bootstrap (Unit)", () => {
    let Sentry, logger, registerGracefulShutdown, connectDB, startUserCascadeWorker, processOn, exitSpy;
    let savedPort;

    const loadServer = async () => {
        require("../../src/server");
        await flush();
    };

    const processHandler = (event) => processOn.mock.calls.find((c) => c[0] === event)?.[1];

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockOrder.length = 0;
        savedPort = process.env.PORT;
        delete process.env.PORT;

        processOn = jest.spyOn(process, "on").mockImplementation(() => process);
        exitSpy = jest.spyOn(process, "exit").mockImplementation(() => undefined);

        mockServer.close.mockImplementation((cb) => cb && cb());
        mockListen.mockImplementation(() => mockServer);
        mockWorker.stop.mockResolvedValue(undefined);

        Sentry = require("@sentry/node");
        logger = require("@leapmentor/shared/utils/logger");
        ({ registerGracefulShutdown } = require("@leapmentor/shared/utils/gracefulShutdown"));
        ({ connectDB } = require("@leapmentor/shared/config/database"));
        ({ startUserCascadeWorker } = require("../../src/workers/userCascadeWorker"));
        connectDB.mockResolvedValue(undefined);
        startUserCascadeWorker.mockReturnValue(mockWorker);
    });

    afterEach(() => {
        processOn.mockRestore();
        exitSpy.mockRestore();
        if (savedPort === undefined) delete process.env.PORT;
        else process.env.PORT = savedPort;
    });

    it("should load instrumentation first, then dotenv, then the app", async () => {
        await loadServer();

        expect(mockOrder.indexOf("instrument")).toBe(0);
        expect(mockOrder.indexOf("instrument")).toBeLessThan(mockOrder.indexOf("dotenv"));
        expect(mockOrder.indexOf("dotenv")).toBeLessThan(mockOrder.indexOf("app"));
    });

    it("should connect to the database before it starts listening", async () => {
        let resolveDb;
        connectDB.mockReturnValue(new Promise((resolve) => { resolveDb = resolve; }));

        await loadServer();
        expect(connectDB).toHaveBeenCalledTimes(1);
        expect(mockListen).not.toHaveBeenCalled();

        resolveDb();
        await flush();
        expect(mockListen).toHaveBeenCalledTimes(1);
    });

    it("should create the HTTP server from the express app", async () => {
        await loadServer();

        expect(mockCreateServer).toHaveBeenCalledWith(mockApp);
    });

    it("should listen on port 5000 when PORT is not set", async () => {
        await loadServer();

        expect(mockListen).toHaveBeenCalledWith(5000, expect.any(Function));
    });

    it("should listen on the PORT environment variable when set", async () => {
        process.env.PORT = "5001";

        await loadServer();

        expect(mockListen).toHaveBeenCalledWith("5001", expect.any(Function));
    });

    it("should log the port once the server is listening", async () => {
        process.env.PORT = "5001";
        await loadServer();

        mockListen.mock.calls[0][1]();

        expect(logger.info).toHaveBeenCalledWith("identity service listening on port 5001");
    });

    it("should start the user cascade worker with the shared userCascade service", async () => {
        await loadServer();

        expect(startUserCascadeWorker).toHaveBeenCalledTimes(1);
        expect(startUserCascadeWorker).toHaveBeenCalledWith({ userCascade: mockUserCascade });
    });

    it("should register graceful shutdown for the identity service with the HTTP server", async () => {
        await loadServer();

        expect(registerGracefulShutdown).toHaveBeenCalledTimes(1);
        expect(registerGracefulShutdown).toHaveBeenCalledWith(expect.objectContaining({
            name: "identity",
            server: mockServer,
            closeServer: expect.any(Function),
        }));
    });

    describe("closeServer (graceful shutdown)", () => {
        const getCloseServer = () => registerGracefulShutdown.mock.calls[0][0].closeServer;

        it("should stop the worker first and then close the server", async () => {
            await loadServer();
            const cb = jest.fn();

            getCloseServer()(cb);
            await flush();

            expect(mockWorker.stop).toHaveBeenCalledTimes(1);
            expect(mockServer.close).toHaveBeenCalledTimes(1);
            expect(mockWorker.stop.mock.invocationCallOrder[0]).toBeLessThan(mockServer.close.mock.invocationCallOrder[0]);
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it("should still close the server when stopping the worker fails", async () => {
            mockWorker.stop.mockRejectedValue(new Error("redis gone"));
            await loadServer();
            const cb = jest.fn();

            getCloseServer()(cb);
            await flush();

            expect(mockServer.close).toHaveBeenCalledTimes(1);
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it("should wait for the worker to stop before closing the server", async () => {
            let finishStop;
            mockWorker.stop.mockReturnValue(new Promise((resolve) => { finishStop = resolve; }));
            await loadServer();

            getCloseServer()(jest.fn());
            await flush();
            expect(mockServer.close).not.toHaveBeenCalled();

            finishStop();
            await flush();
            expect(mockServer.close).toHaveBeenCalledTimes(1);
        });
    });

    describe("process-level error handlers", () => {
        it("should register unhandledRejection and uncaughtException handlers", async () => {
            await loadServer();

            expect(processHandler("unhandledRejection")).toEqual(expect.any(Function));
            expect(processHandler("uncaughtException")).toEqual(expect.any(Function));
        });

        it("should report an unhandled rejection to Sentry and the logger without exiting", async () => {
            await loadServer();
            const reason = new Error("promise failed");

            processHandler("unhandledRejection")(reason);

            expect(Sentry.captureException).toHaveBeenCalledWith(reason);
            expect(logger.error).toHaveBeenCalledWith("Unhandled Promise Rejection", expect.objectContaining({ reason: "promise failed" }));
            expect(exitSpy).not.toHaveBeenCalled();
        });

        it("should log a non-Error rejection reason as-is", async () => {
            await loadServer();

            processHandler("unhandledRejection")("plain string reason");

            expect(logger.error).toHaveBeenCalledWith("Unhandled Promise Rejection", expect.objectContaining({ reason: "plain string reason" }));
        });

        it("should exit with code 1 on an uncaught exception that is not operational", async () => {
            await loadServer();
            const err = new Error("programmer error");

            processHandler("uncaughtException")(err);

            expect(Sentry.captureException).toHaveBeenCalledWith(err);
            expect(logger.error).toHaveBeenCalledWith("Uncaught Exception", expect.objectContaining({ error: "programmer error" }));
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it("should keep running after an uncaught operational exception", async () => {
            await loadServer();
            const err = Object.assign(new Error("expected failure"), { isOperational: true });

            processHandler("uncaughtException")(err);

            expect(Sentry.captureException).toHaveBeenCalledWith(err);
            expect(exitSpy).not.toHaveBeenCalled();
        });
    });
});
