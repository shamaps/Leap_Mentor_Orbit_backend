const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/earnings.repository");
const { makeConnectRequest, makeSelectedSlot, makeUser } = require("../../fixtures/createTestData");

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Earnings Repository (Integration)", () => {
    describe("findOngoingPaidSessions", () => {
        it("should isolate billing documents that strictly fulfill status matches", async () => {
            const mentorId = new mongoose.Types.ObjectId();
            const menteeId = new mongoose.Types.ObjectId();
            const slotsFixture = [makeSelectedSlot({ date: "2026-07-06", day: "Monday", startTime: "09:00", endTime: "10:00" })];

            // Uses the real model factory to satisfy exact top-level paymentStatus enums ("unpaid", "paid", "refunded")
            await makeConnectRequest({ status: "ongoing", paymentStatus: "paid", mentor: mentorId, mentee: menteeId, mentorPayout: 100, selectedSlots: slotsFixture });
            await makeConnectRequest({ status: "completed", paymentStatus: "paid", mentor: mentorId, mentee: menteeId, mentorPayout: 100, selectedSlots: slotsFixture });
            await makeConnectRequest({ status: "ongoing", paymentStatus: "unpaid", mentor: mentorId, mentee: menteeId, mentorPayout: 100, selectedSlots: slotsFixture });

            const ongoingPaid = await repo.findOngoingPaidSessions(mentorId);
            expect(ongoingPaid).toHaveLength(1);
            expect(ongoingPaid[0].mentorPayout).toBe(100);
        });
    });

    describe("findUserIdsByName", () => {
        it("should pull matching accounts utilizing case-insensitive regex lookups", async () => {
            // Evaluates text filters accurately against real User schema structures (single role array, explicit validations)
            await makeUser({ name: "Robert Mentor", email: "mentor@robert.com", roles: ["mentor"] });
            await makeUser({ name: "robert mentee", email: "mentee@robert.com", roles: ["mentee"] });
            await makeUser({ name: "Alice", email: "alice@test.com", roles: ["mentee"] });

            const matchRows = await repo.findUserIdsByName("RoBeRt");
            expect(matchRows).toHaveLength(2);
        });
    });
});