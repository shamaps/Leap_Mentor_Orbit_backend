const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/slotLock.repository");
const SlotLock = require("../../../models/SlotLock"); // Import direct production model

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Slot Lock Repository (Integration)", () => {
    describe("refreshOwnLock + createLock", () => {
        it("createLock writes a fresh document on a clean slot", async () => {
            const mentorId = new mongoose.Types.ObjectId();
            const menteeId = new mongoose.Types.ObjectId();
            const expiresAt = new Date(Date.now() + 60000);

            await repo.createLock({
                mentorId, date: "2026-07-06", startTime: "09:00", endTime: "10:00", menteeId, expiresAt
            });

            const count = await SlotLock.countDocuments({ mentorId });
            expect(count).toBe(1);
        });

        it("refreshOwnLock extends the same document instead of creating a duplicate", async () => {
            const mentorId = new mongoose.Types.ObjectId();
            const menteeId = new mongoose.Types.ObjectId();
            const firstExpiry = new Date(Date.now() + 60000);

            await repo.createLock({
                mentorId, date: "2026-07-06", startTime: "09:00", endTime: "10:00", menteeId, expiresAt: firstExpiry
            });

            const secondExpiry = new Date(Date.now() + 120000);
            const refreshed = await repo.refreshOwnLock({
                mentorId, date: "2026-07-06", startTime: "09:00", endTime: "10:00", menteeId, expiresAt: secondExpiry
            });

            const count = await SlotLock.countDocuments({ mentorId });
            expect(count).toBe(1); // still one document — refreshed in place, not duplicated
            expect(refreshed.expiresAt.getTime()).toBe(secondExpiry.getTime());
        });

        it("refreshOwnLock returns null when the caller doesn't already hold this exact slot", async () => {
            const mentorId = new mongoose.Types.ObjectId();
            const menteeId = new mongoose.Types.ObjectId();

            const result = await repo.refreshOwnLock({
                mentorId, date: "2026-07-06", startTime: "09:00", endTime: "10:00",
                menteeId, expiresAt: new Date(Date.now() + 60000),
            });

            expect(result).toBeNull();
        });

        it("createLock throws a duplicate-key error when a DIFFERENT mentee already holds the exact same slot — this is the atomic fix for two mentees racing to lock the same slot", async () => {
            const mentorId = new mongoose.Types.ObjectId();
            const menteeA = new mongoose.Types.ObjectId();
            const menteeB = new mongoose.Types.ObjectId();

            await repo.createLock({
                mentorId, date: "2026-07-06", startTime: "09:00", endTime: "10:00",
                menteeId: menteeA, expiresAt: new Date(Date.now() + 60000),
            });

            await expect(repo.createLock({
                mentorId, date: "2026-07-06", startTime: "09:00", endTime: "10:00",
                menteeId: menteeB, expiresAt: new Date(Date.now() + 60000),
            })).rejects.toMatchObject({ code: 11000 });

            const count = await SlotLock.countDocuments({ mentorId });
            expect(count).toBe(1); // B's attempt never created a second document
        });
    });
});