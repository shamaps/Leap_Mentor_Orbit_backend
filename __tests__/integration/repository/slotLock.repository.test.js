const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/slotLock.repository");
const { makeSlotLock } = require("../../fixtures/createTestData");
const SlotLock = require("../../../models/SlotLock"); // Import direct production model

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Slot Lock Repository (Integration)", () => {
    describe("upsertLock", () => {
        it("should write a fresh document on a clean slot or modify the active record on duplicate keys matches", async () => {
            const mentorId = new mongoose.Types.ObjectId();
            const menteeId = new mongoose.Types.ObjectId();
            const firstExpiry = new Date(Date.now() + 60000);

            await repo.upsertLock({
                mentorId, date: "2026-07-06", startTime: "09:00", endTime: "10:00", menteeId, expiresAt: firstExpiry
            });

            const count = await SlotLock.countDocuments({ mentorId });
            expect(count).toBe(1);

            const secondExpiry = new Date(Date.now() + 120000);
            await repo.upsertLock({
                mentorId, date: "2026-07-06", startTime: "09:00", endTime: "10:00", menteeId, expiresAt: secondExpiry
            });

            const secondCount = await SlotLock.countDocuments({ mentorId });
            expect(secondCount).toBe(1); // Verifies the atomic upsert modifies the exact document rather than appending a duplicate

            const updatedDoc = await SlotLock.findOne({ mentorId });
            expect(updatedDoc.expiresAt.getTime()).toBe(secondExpiry.getTime());
        });
    });
});