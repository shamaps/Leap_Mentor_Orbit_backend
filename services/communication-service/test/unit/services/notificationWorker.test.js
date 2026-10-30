/**
 * @fileoverview Unit tests for the notification worker: event validation, idempotent insert,
 * socket push and worker start-up. The repository and socket emitter are injected, so no
 * database or Redis is needed.
 */

const mockConfig = { notificationWorkerEnabled: true };
let mockWorkerOptions;
const mockWorker = { start: jest.fn(), stop: async () => { } };

jest.mock("@leapmentor/shared/config/env", () => mockConfig);
jest.mock("@leapmentor/shared/utils/logger", () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));
jest.mock("@leapmentor/shared/utils/streams", () => ({
    createWorker: (options) => { mockWorkerOptions = options; return mockWorker; },
}));

const {
    startNotificationWorker,
    buildHandlers,
    createNotificationHandler,
    validateEvent,
    NOTIFICATION_GROUP,
    SOCKET_EVENT,
} = require("../../../src/workers/notificationWorker");

const RECIPIENT = "a".repeat(24);
const REQUEST_ID = "b".repeat(24);

const validEvent = (over = {}) => ({
    eventId: `connect_request_received:${RECIPIENT}:${REQUEST_ID}`,
    recipient: RECIPIENT,
    type: "connect_request_received",
    title: "New Connect Request",
    message: "You have a new connect request from a mentee",
    metadata: { requestId: REQUEST_ID },
    ...over,
});

const makeLog = () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() });

// Builds a handler with a fake repository and emitter, and returns them for assertions.
const build = ({ createImpl, emitToUser = jest.fn() } = {}) => {
    const saved = { _id: "n1", toJSON: () => ({ id: "n1", type: "connect_request_received" }) };
    const repo = { createNotification: jest.fn(createImpl || (async () => saved)) };
    const log = makeLog();
    const handler = createNotificationHandler({ repo, getEmitToUser: () => emitToUser, log });
    return { handler, repo, emitToUser, log, saved };
};

const rejectionOf = async (promise) => {
    try { await promise; } catch (err) { return err; }
    throw new Error("expected the promise to reject");
};

describe("notification worker", () => {
    describe("creating notifications", () => {
        it("should insert the notification with the event id and push it to the recipient", async () => {
            const { handler, repo, emitToUser } = build();

            const result = await handler(validEvent());

            expect(result).toEqual({ created: true });
            expect(repo.createNotification).toHaveBeenCalledWith({
                eventId: `connect_request_received:${RECIPIENT}:${REQUEST_ID}`,
                recipient: RECIPIENT,
                type: "connect_request_received",
                title: "New Connect Request",
                message: "You have a new connect request from a mentee",
                metadata: { requestId: REQUEST_ID },
            });
            expect(emitToUser).toHaveBeenCalledTimes(1);
            expect(emitToUser).toHaveBeenCalledWith(RECIPIENT, SOCKET_EVENT, { id: "n1", type: "connect_request_received" });
        });

        it("should use new_notification as the socket event name", () => {
            expect(SOCKET_EVENT).toBe("new_notification");
        });

        it("should default metadata to an empty object", async () => {
            const { handler, repo } = build();
            const event = validEvent();
            delete event.metadata;

            await handler(event);

            expect(repo.createNotification.mock.calls[0][0].metadata).toEqual({});
        });

        it("should ignore unknown fields on the event", async () => {
            const { handler, repo } = build();

            await handler(validEvent({ isAdmin: true, read: true }));

            const created = repo.createNotification.mock.calls[0][0];
            expect(created).not.toHaveProperty("isAdmin");
            expect(created).not.toHaveProperty("read");
        });

        it.each([
            "connect_request_received", "connect_request_accepted", "connect_request_declined",
            "upcoming_session", "new_message", "session_completed", "new_review", "support_resolved",
        ])("should accept the notification type %s", async (type) => {
            const { handler, repo } = build();

            await handler(validEvent({ type }));

            expect(repo.createNotification).toHaveBeenCalledTimes(1);
        });

        it("should pass the plain saved object to the socket when it has no toJSON", async () => {
            const plain = { _id: "n2", title: "plain" };
            const { handler, emitToUser } = build({ createImpl: async () => plain });

            await handler(validEvent());

            expect(emitToUser).toHaveBeenCalledWith(RECIPIENT, SOCKET_EVENT, plain);
        });
    });

    describe("invalid events", () => {
        it.each([
            ["a missing eventId", { eventId: undefined }, "eventId"],
            ["an empty eventId", { eventId: "" }, "eventId"],
            ["an over-long eventId", { eventId: "x".repeat(201) }, "eventId"],
            ["a missing recipient", { recipient: undefined }, "recipient"],
            ["a recipient that is not an ObjectId", { recipient: "not-an-id" }, "recipient"],
            ["a numeric recipient", { recipient: 123 }, "recipient"],
            ["an unknown type", { type: "made_up_type" }, "type"],
            ["a missing type", { type: undefined }, "type"],
            ["an empty title", { title: "" }, "title"],
            ["a title over 200 characters", { title: "x".repeat(201) }, "title"],
            ["an empty message", { message: "" }, "message"],
            ["a message over 1000 characters", { message: "x".repeat(1001) }, "message"],
            ["metadata that is an array", { metadata: [1, 2] }, "metadata"],
            ["metadata that is null", { metadata: null }, "metadata"],
        ])("should dead-letter an event with %s without retrying", async (_label, over, field) => {
            const { handler, repo, emitToUser } = build();

            const err = await rejectionOf(handler(validEvent(over)));

            expect(err.message).toMatch(/Invalid notification event/);
            expect(err.message).toContain(field);
            expect(err.retryable).toBe(false);
            expect(repo.createNotification).not.toHaveBeenCalled();
            expect(emitToUser).not.toHaveBeenCalled();
        });

        it.each([null, undefined, "text", 42, ["a"]])("should reject a payload that is %p", async (payload) => {
            const { handler, repo } = build();

            const err = await rejectionOf(handler(payload));

            expect(err.retryable).toBe(false);
            expect(repo.createNotification).not.toHaveBeenCalled();
        });

        it("should list every invalid field in one message", () => {
            expect(() => validateEvent(validEvent({ recipient: "x", title: "" })))
                .toThrow(/recipient, title/);
        });
    });

    describe("duplicate delivery", () => {
        it("should treat a duplicate event id as success without a second socket push", async () => {
            const dup = Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
            const { handler, emitToUser, log } = build({ createImpl: async () => { throw dup; } });

            const result = await handler(validEvent());

            expect(result).toEqual({ duplicate: true });
            expect(emitToUser).not.toHaveBeenCalled();
            expect(log.info).toHaveBeenCalledWith(
                "Duplicate notification event ignored",
                { eventId: `connect_request_received:${RECIPIENT}:${REQUEST_ID}` }
            );
        });
    });

    describe("repository failures", () => {
        it("should retry on a temporary database failure by rethrowing it unchanged", async () => {
            const dbError = new Error("mongo down");
            const { handler } = build({ createImpl: async () => { throw dbError; } });

            const err = await rejectionOf(handler(validEvent()));

            expect(err).toBe(dbError);
            expect(err.retryable).toBeUndefined();
        });

        it.each(["ValidationError", "CastError"])("should dead-letter a %s from the database layer", async (name) => {
            const mongooseError = Object.assign(new Error("bad value"), { name });
            const { handler } = build({ createImpl: async () => { throw mongooseError; } });

            const err = await rejectionOf(handler(validEvent()));

            expect(err.retryable).toBe(false);
            expect(err.message).toBe("bad value");
        });
    });

    describe("real-time push", () => {
        it("should still succeed when the socket server has not started yet", async () => {
            const { handler, repo } = build({ emitToUser: null });

            await expect(handler(validEvent())).resolves.toEqual({ created: true });
            expect(repo.createNotification).toHaveBeenCalledTimes(1);
        });

        it("should still succeed, and log a warning, when the socket emit throws", async () => {
            const emitToUser = jest.fn(() => { throw new Error("socket exploded"); });
            const { handler, log } = build({ emitToUser });

            await expect(handler(validEvent())).resolves.toEqual({ created: true });

            expect(log.warn).toHaveBeenCalledWith(
                "Notification socket emit failed",
                expect.objectContaining({ error: "socket exploded" })
            );
        });
    });

    describe("worker start-up", () => {
        beforeEach(() => {
            mockConfig.notificationWorkerEnabled = true;
            mockWorkerOptions = undefined;
        });

        it("should expose a notification.create handler", () => {
            const handlers = buildHandlers();

            expect(Object.keys(handlers)).toEqual(["notification.create"]);
            expect(typeof handlers["notification.create"]).toBe("function");
        });

        it("should start a worker on the notification stream in its own consumer group", () => {
            const worker = startNotificationWorker();

            expect(worker).toBe(mockWorker);
            expect(mockWorkerOptions.stream).toBe("stream:notification");
            expect(mockWorkerOptions.group).toBe(NOTIFICATION_GROUP);
            expect(NOTIFICATION_GROUP).toBe("notification-workers");
            expect(typeof mockWorkerOptions.handlers["notification.create"]).toBe("function");
            expect(mockWorker.start).toHaveBeenCalledTimes(1);
        });

        it("should let callers override worker options", () => {
            startNotificationWorker({ maxAttempts: 3 });

            expect(mockWorkerOptions.maxAttempts).toBe(3);
        });

        it("should not start anything when the worker is disabled", async () => {
            mockConfig.notificationWorkerEnabled = false;

            const worker = startNotificationWorker();

            expect(mockWorkerOptions).toBeUndefined();
            expect(mockWorker.start).not.toHaveBeenCalled();
            await expect(worker.stop()).resolves.toBeUndefined();
        });
    });
});