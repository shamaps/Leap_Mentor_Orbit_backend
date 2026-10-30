/**
 * @fileoverview Unit tests for the notification publisher used by Engagement
 * (shared/utils/notificationQueue.js).
 */

const {
    NOTIFICATION_STREAM,
    NOTIFICATION_EVENT,
    buildEventId,
    createNotificationPublisher,
    publishNotification,
} = require("@leapmentor/shared/utils/notificationQueue");

const RECIPIENT = "a".repeat(24);
const REQUEST_ID = "b".repeat(24);

// ObjectId-like value: String() gives the hex id and JSON.stringify gives the same hex string.
const objectIdLike = (hex) => ({ toString: () => hex, toJSON: () => hex });

const makeLogger = () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() });

const build = ({ publishImpl } = {}) => {
    const published = [];
    const log = makeLogger();
    const publishNotificationFn = createNotificationPublisher({
        publish: async (...args) => {
            published.push(args);
            return publishImpl ? publishImpl(...args) : "1-0";
        },
        log,
    });
    return { publishNotificationFn, published, log };
};

const input = (over = {}) => ({
    recipient: RECIPIENT,
    type: "connect_request_received",
    title: "New Connect Request",
    message: "You have a new connect request from a mentee",
    metadata: { requestId: REQUEST_ID },
    dedupeKey: REQUEST_ID,
    ...over,
});

describe("notification publisher", () => {
    it("should expose the stream and event names the worker listens on", () => {
        expect(NOTIFICATION_STREAM).toBe("stream:notification");
        expect(NOTIFICATION_EVENT).toBe("notification.create");
        expect(typeof publishNotification).toBe("function");
    });

    describe("publishing", () => {
        it("should publish one notification.create event with the payload and the event id as key", async () => {
            const { publishNotificationFn, published } = build();

            const result = await publishNotificationFn(input());

            const expectedId = `connect_request_received:${RECIPIENT}:${REQUEST_ID}`;
            expect(result).toEqual({ queued: true, eventId: expectedId });
            expect(published).toHaveLength(1);
            const [stream, type, payload, options] = published[0];
            expect(stream).toBe("stream:notification");
            expect(type).toBe("notification.create");
            expect(payload).toEqual({
                eventId: expectedId,
                recipient: RECIPIENT,
                type: "connect_request_received",
                title: "New Connect Request",
                message: "You have a new connect request from a mentee",
                metadata: { requestId: REQUEST_ID },
            });
            expect(options).toEqual({ key: expectedId });
        });

        it("should turn ObjectId-like recipients and metadata values into plain strings", async () => {
            const { publishNotificationFn, published } = build();

            await publishNotificationFn(input({
                recipient: objectIdLike(RECIPIENT),
                metadata: { requestId: objectIdLike(REQUEST_ID), mentorId: objectIdLike("c".repeat(24)), amount: 50 },
            }));

            const payload = published[0][2];
            expect(payload.recipient).toBe(RECIPIENT);
            expect(payload.metadata).toEqual({ requestId: REQUEST_ID, mentorId: "c".repeat(24), amount: 50 });
        });

        it("should drop undefined metadata fields and default missing metadata to an empty object", async () => {
            const { publishNotificationFn, published } = build();

            await publishNotificationFn(input({ metadata: { requestId: REQUEST_ID, amount: undefined } }));
            await publishNotificationFn(input({ metadata: undefined, dedupeKey: "other" }));

            expect(published[0][2].metadata).toEqual({ requestId: REQUEST_ID });
            expect(published[1][2].metadata).toEqual({});
        });

        it("should convert Date metadata to ISO strings so it survives JSON", async () => {
            const { publishNotificationFn, published } = build();
            const when = new Date("2026-11-01T10:00:00Z");

            await publishNotificationFn(input({ metadata: { sessionAt: when } }));

            expect(published[0][2].metadata.sessionAt).toBe("2026-11-01T10:00:00.000Z");
        });
    });

    describe("event ids", () => {
        it("should build the same event id for the same business event, so retries are recognised", async () => {
            const { publishNotificationFn, published } = build();

            await publishNotificationFn(input());
            await publishNotificationFn(input());

            expect(published[0][2].eventId).toBe(published[1][2].eventId);
        });

        it("should give each recipient of the same event its own event id", async () => {
            const { publishNotificationFn, published } = build();

            await publishNotificationFn(input({ recipient: "a".repeat(24) }));
            await publishNotificationFn(input({ recipient: "d".repeat(24) }));

            expect(published[0][2].eventId).not.toBe(published[1][2].eventId);
        });

        it("should give different notification types for the same request their own event ids", async () => {
            const { publishNotificationFn, published } = build();

            await publishNotificationFn(input({ type: "connect_request_accepted" }));
            await publishNotificationFn(input({ type: "connect_request_declined" }));

            expect(published[0][2].eventId).not.toBe(published[1][2].eventId);
        });

        it("should fall back to a random event id when no dedupeKey is given", async () => {
            const { publishNotificationFn, published } = build();

            await publishNotificationFn(input({ dedupeKey: undefined }));
            await publishNotificationFn(input({ dedupeKey: undefined }));

            expect(published[0][2].eventId).toMatch(/^[0-9a-f-]{36}$/);
            expect(published[0][2].eventId).not.toBe(published[1][2].eventId);
        });

        it("should expose buildEventId with the same rules", () => {
            expect(buildEventId({ type: "t", recipient: "r", dedupeKey: "k" })).toBe("t:r:k");
            expect(buildEventId({ type: "t", recipient: "r" })).toMatch(/^[0-9a-f-]{36}$/);
        });
    });

    describe("failures", () => {
        it("should log and swallow a publish failure so the calling request is not failed", async () => {
            const { publishNotificationFn, log } = build({ publishImpl: async () => { throw new Error("redis down"); } });

            await expect(publishNotificationFn(input())).resolves.toBeUndefined();

            expect(log.error).toHaveBeenCalledWith(
                "Failed to queue notification",
                expect.objectContaining({ error: "redis down", type: "connect_request_received", recipient: RECIPIENT })
            );
        });

        it("should not publish anything when the recipient is missing", async () => {
            const { publishNotificationFn, published, log } = build();

            const result = await publishNotificationFn(input({ recipient: undefined }));

            expect(result).toBeUndefined();
            expect(published).toHaveLength(0);
            expect(log.error).toHaveBeenCalledWith(
                "Failed to queue notification",
                expect.objectContaining({ error: "recipient is required" })
            );
        });

        it("should not publish and should not throw when called with no arguments", async () => {
            const { publishNotificationFn, published } = build();

            await expect(publishNotificationFn()).resolves.toBeUndefined();

            expect(published).toHaveLength(0);
        });
    });
});