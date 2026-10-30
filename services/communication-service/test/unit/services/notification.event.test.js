/**
 * @fileoverview Database tests for the notification eventId: storing it, the unique partial
 * index that stops duplicates, and the Mongoose errors the worker relies on.
 */

const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const Notification = require("@leapmentor/shared/models/Notification");
const repo = require("@leapmentor/shared/repositories/notification.repository");

beforeAll(async () => {
    await dbHandler.connect();
    await Notification.init(); 
});
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

const newId = () => new mongoose.Types.ObjectId();

const input = (over = {}) => ({
    recipient: newId(),
    type: "connect_request_received",
    title: "New Connect Request",
    message: "You have a new connect request",
    ...over,
});

describe("Notification eventId (Integration)", () => {
    describe("storing", () => {
        it("should store the eventId when the repository is given one", async () => {
            await repo.createNotification(input({ eventId: "evt-1" }));

            const saved = await Notification.findOne({ eventId: "evt-1" }).lean();
            expect(saved).not.toBeNull();
            expect(saved.eventId).toBe("evt-1");
        });

        it("should leave eventId unset when none is given", async () => {
            await repo.createNotification(input());

            const saved = await Notification.findOne({}).lean();
            expect(saved).not.toHaveProperty("eventId");
        });

        it("should cast string ids in the metadata to ObjectIds", async () => {
            const requestId = newId();

            await repo.createNotification(input({ eventId: "evt-meta", metadata: { requestId: String(requestId) } }));

            const saved = await Notification.findOne({ eventId: "evt-meta" }).lean();
            expect(saved.metadata.requestId.equals(requestId)).toBe(true);
        });
    });

    describe("duplicate protection", () => {
        it("should reject a second notification with the same eventId using a duplicate-key error", async () => {
            await repo.createNotification(input({ eventId: "evt-dup" }));

            await expect(repo.createNotification(input({ eventId: "evt-dup" })))
                .rejects.toHaveProperty("code", 11000);
            expect(await Notification.countDocuments({ eventId: "evt-dup" })).toBe(1);
        });

        it("should allow any number of notifications that have no eventId", async () => {
            await repo.createNotification(input());
            await repo.createNotification(input());
            await repo.createNotification(input());

            expect(await Notification.countDocuments({})).toBe(3);
        });

        it("should allow different eventIds side by side", async () => {
            await repo.createNotification(input({ eventId: "evt-a" }));
            await repo.createNotification(input({ eventId: "evt-b" }));

            expect(await Notification.countDocuments({})).toBe(2);
        });
    });

    describe("the index", () => {
        it("should declare a unique index on eventId that only applies to string values", () => {
            const entry = Notification.schema.indexes().find(([fields]) => fields.eventId === 1);

            expect(entry).toBeDefined();
            expect(entry[1]).toMatchObject({ unique: true, partialFilterExpression: { eventId: { $type: "string" } } });
        });

        it("should exist in the database", async () => {
            const indexes = await Notification.collection.indexes();
            const eventIdIndex = indexes.find((i) => i.key && i.key.eventId === 1);

            expect(eventIdIndex).toBeDefined();
            expect(eventIdIndex.unique).toBe(true);
            expect(eventIdIndex.partialFilterExpression).toEqual({ eventId: { $type: "string" } });
        });
    });

    describe("errors the worker depends on", () => {
        it("should report an unknown type as a ValidationError", async () => {
            await expect(repo.createNotification(input({ type: "made_up_type", eventId: "evt-bad-type" })))
                .rejects.toHaveProperty("name", "ValidationError");
        });

        it("should report a malformed recipient as a ValidationError", async () => {
            await expect(repo.createNotification(input({ recipient: "not-an-id", eventId: "evt-bad-recipient" })))
                .rejects.toHaveProperty("name", "ValidationError");
        });
    });
});