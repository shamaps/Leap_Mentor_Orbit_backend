const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/availability.repository");
const { makeConnectRequest, makeSelectedSlot } = require("../../fixtures/createTestData");
const Availability = require("../../../models/Availability"); // Replaces hand-rolled mini schemas

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Availability Repository (Integration)", () => {
    let mentorId;

    beforeEach(() => {
        mentorId = new mongoose.Types.ObjectId();
    });

    describe("createAvailability", () => {
        it("should successfully populate defaults schema fallbacks if parameters arrays arrive empty", async () => {
            const created = await repo.createAvailability({ mentorId });

            expect(created.timezone).toBe("Asia/Kolkata");
            expect(created.sessionDurations).toContain(30);
        });
    });

    describe("findBookedRequests", () => {
        it("should capture items mapped strictly to actionable statuses while ignoring rejected sessions", async () => {
            const menteeId = new mongoose.Types.ObjectId();
            const validSlotFixture = [makeSelectedSlot({ date: "2026-07-01", day: "Monday", startTime: "10:00", endTime: "11:00" })];

            // Safely leverages actual ConnectRequest production validation rules
            await makeConnectRequest({ status: "pending", mentor: mentorId, mentee: menteeId, selectedSlots: validSlotFixture });
            await makeConnectRequest({ status: "accepted", mentor: mentorId, mentee: menteeId, selectedSlots: validSlotFixture });
            await makeConnectRequest({ status: "rejected", mentor: mentorId, mentee: menteeId, selectedSlots: validSlotFixture });

            const listings = await repo.findBookedRequests(mentorId);
            expect(listings).toHaveLength(2);
        });
    });
});