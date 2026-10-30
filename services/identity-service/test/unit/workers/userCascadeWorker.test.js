jest.mock("@leapmentor/shared/utils/streams", () => ({
    createWorker: jest.fn(),
}));

const { createWorker } = require("@leapmentor/shared/utils/streams");
const createUserCascadeService = require("../../../src/services/userCascade.service");
const { startUserCascadeWorker } = require("../../../src/workers/userCascadeWorker");

const { CASCADE_STREAM, CASCADE_GROUP, ACTIONS } = createUserCascadeService;

describe("User Cascade Worker (Unit)", () => {
    let mockWorker, userCascade;

    beforeEach(() => {
        jest.clearAllMocks();
        mockWorker = { start: jest.fn(), stop: jest.fn().mockResolvedValue(undefined) };
        createWorker.mockReturnValue(mockWorker);
        userCascade = { handlers: { "catalog.hardDelete": jest.fn(), "payments.restore": jest.fn() } };
    });

    it("should create the worker on the cascade stream and consumer group with the service handlers", () => {
        startUserCascadeWorker({ userCascade });

        expect(createWorker).toHaveBeenCalledTimes(1);
        expect(createWorker).toHaveBeenCalledWith({
            stream: CASCADE_STREAM,
            group: CASCADE_GROUP,
            handlers: userCascade.handlers,
        });
    });

    it("should start the worker exactly once, after it has been created", () => {
        startUserCascadeWorker({ userCascade });

        expect(mockWorker.start).toHaveBeenCalledTimes(1);
        expect(createWorker.mock.invocationCallOrder[0]).toBeLessThan(mockWorker.start.mock.invocationCallOrder[0]);
    });

    it("should return the worker so the caller can stop it on shutdown", async () => {
        const worker = startUserCascadeWorker({ userCascade });

        expect(worker).toBe(mockWorker);
        await expect(worker.stop()).resolves.toBeUndefined();
    });

    it("should forward extra options to createWorker without leaking userCascade into them", () => {
        startUserCascadeWorker({ userCascade, concurrency: 5, maxRetries: 3 });

        const passed = createWorker.mock.calls[0][0];
        expect(passed).toMatchObject({ concurrency: 5, maxRetries: 3 });
        expect(passed).not.toHaveProperty("userCascade");
    });

    it("should not start the worker when createWorker throws", () => {
        createWorker.mockImplementation(() => { throw new Error("redis config missing"); });

        expect(() => startUserCascadeWorker({ userCascade })).toThrow("redis config missing");
        expect(mockWorker.start).not.toHaveBeenCalled();
    });

    it("should propagate a failure from worker.start()", () => {
        mockWorker.start.mockImplementation(() => { throw new Error("cannot connect to stream"); });

        expect(() => startUserCascadeWorker({ userCascade })).toThrow("cannot connect to stream");
    });

    it("should register a handler for every cascade action when wired to the real service", () => {
        const service = createUserCascadeService({
            publish: jest.fn(),
            clients: { catalog: {}, engagement: {}, payments: {} },
            logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
        });

        startUserCascadeWorker({ userCascade: service });

        const { handlers } = createWorker.mock.calls[0][0];
        expect(Object.keys(handlers).sort()).toEqual(Object.keys(ACTIONS).sort());
        Object.values(handlers).forEach((handler) => expect(typeof handler).toBe("function"));
    });
});