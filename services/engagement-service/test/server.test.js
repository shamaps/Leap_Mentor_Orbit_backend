/**
 * @fileoverview Tests for the engagement service's startup script (src/server.js).
 * Everything with a side effect is mocked: no database, no port, no signal handlers.
 * The script starts itself when it is loaded, so each test loads a fresh copy.
 */

const mockFakeServer = { fake: "server" };

jest.mock("@leapmentor/shared/instrument", () => ({}), { virtual: true });
jest.mock("dotenv", () => ({ config: jest.fn() }));
jest.mock("@sentry/node", () => ({ captureException: jest.fn() }));
jest.mock("@leapmentor/shared/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock("@leapmentor/shared/utils/gracefulShutdown", () => ({ registerGracefulShutdown: jest.fn() }));
jest.mock("@leapmentor/shared/config/database", () => ({ connectDB: jest.fn() }));
jest.mock("../src/app", () => ({ fake: "app" }));
jest.mock("../src/config/container", () => ({ serviceCompensation: { start: jest.fn() } }));
jest.mock("node:http", () => ({ createServer: jest.fn() }));

const http = require("node:http");
const Sentry = require("@sentry/node");
const logger = require("@leapmentor/shared/utils/logger");
const { registerGracefulShutdown } = require("@leapmentor/shared/utils/gracefulShutdown");
const { connectDB } = require("@leapmentor/shared/config/database");
const { serviceCompensation } = require("../src/config/container");
const app = require("../src/app");

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("engagement server startup", () => {
    let processOn, processExit, listen, savedPort;

    const boot = async () => {
        jest.isolateModules(() => require("../src/server"));
        await flush();
    };

    const handlerFor = (event) => processOn.mock.calls.find(([name]) => name === event)[1];

    beforeEach(() => {
        jest.clearAllMocks();
        savedPort = process.env.PORT;
        delete process.env.PORT;

        connectDB.mockResolvedValue();
        listen = jest.fn((port, onListening) => { onListening?.(); return mockFakeServer; });
        http.createServer.mockReturnValue({ listen });
        processOn = jest.spyOn(process, "on").mockImplementation(() => process);
        processExit = jest.spyOn(process, "exit").mockImplementation(() => undefined);
    });

    afterEach(() => {
        processOn.mockRestore();
        processExit.mockRestore();
        if (savedPort === undefined) delete process.env.PORT;
        else process.env.PORT = savedPort;
    });

    describe("startup sequence", () => {
        it("connects to the database, then starts the compensation worker, then opens the port", async () => {
            await boot();

            expect(connectDB).toHaveBeenCalledTimes(1);
            expect(serviceCompensation.start).toHaveBeenCalledTimes(1);
            expect(listen).toHaveBeenCalledTimes(1);

            const order = (fn) => fn.mock.invocationCallOrder[0];
            expect(order(connectDB)).toBeLessThan(order(serviceCompensation.start));
            expect(order(serviceCompensation.start)).toBeLessThan(order(listen));
        });

        it("serves the express app on port 5000 by default", async () => {
            await boot();

            expect(http.createServer).toHaveBeenCalledWith(app);
            expect(listen).toHaveBeenCalledWith(5000, expect.any(Function));
            expect(logger.info).toHaveBeenCalledWith("engagement service listening on port 5000");
        });

        it("uses the PORT setting when there is one", async () => {
            process.env.PORT = "6123";

            await boot();

            expect(listen).toHaveBeenCalledWith("6123", expect.any(Function));
            expect(logger.info).toHaveBeenCalledWith("engagement service listening on port 6123");
        });

        it("registers a graceful shutdown for the running server", async () => {
            await boot();
            expect(registerGracefulShutdown).toHaveBeenCalledWith({ name: "engagement", server: mockFakeServer });
        });

        it("does nothing else until the database connection is ready", async () => {
            connectDB.mockReturnValue(new Promise(() => {})); // never connects

            await boot();

            expect(connectDB).toHaveBeenCalledTimes(1);
            expect(serviceCompensation.start).not.toHaveBeenCalled();
            expect(listen).not.toHaveBeenCalled();
        });
    });

    describe("process-level error handlers", () => {
        it("registers one handler for unhandled rejections and one for uncaught exceptions", async () => {
            await boot();
            const events = processOn.mock.calls.map(([name]) => name);
            expect(events).toEqual(expect.arrayContaining(["unhandledRejection", "uncaughtException"]));
        });

        it("reports an unhandled rejection to Sentry and the log, and keeps running", async () => {
            await boot();
            const reason = new Error("promise failed");

            handlerFor("unhandledRejection")(reason);

            expect(Sentry.captureException).toHaveBeenCalledWith(reason);
            expect(logger.error).toHaveBeenCalledWith("Unhandled Promise Rejection", expect.objectContaining({ reason: "promise failed" }));
            expect(processExit).not.toHaveBeenCalled();
        });

        it("logs a rejection whose reason is not an Error", async () => {
            await boot();

            handlerFor("unhandledRejection")("just a string");

            expect(logger.error).toHaveBeenCalledWith("Unhandled Promise Rejection", expect.objectContaining({ reason: "just a string" }));
        });

        it("exits the process after an uncaught exception that is not an expected application error", async () => {
            await boot();
            const err = new Error("bug");

            handlerFor("uncaughtException")(err);

            expect(Sentry.captureException).toHaveBeenCalledWith(err);
            expect(logger.error).toHaveBeenCalledWith("Uncaught Exception", expect.objectContaining({ error: "bug" }));
            expect(processExit).toHaveBeenCalledWith(1);
        });

        it("stays up after an uncaught exception that is an expected operational error", async () => {
            await boot();
            const err = Object.assign(new Error("expected"), { isOperational: true });

            handlerFor("uncaughtException")(err);

            expect(Sentry.captureException).toHaveBeenCalledWith(err);
            expect(processExit).not.toHaveBeenCalled();
        });
    });
});
