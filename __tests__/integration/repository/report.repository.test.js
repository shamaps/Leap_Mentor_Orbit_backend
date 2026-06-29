const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/report.repository");
const { makeUser, makeConnectRequest, makeSelectedSlot } = require("../../fixtures/createTestData");

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Report Repository (Integration)", () => {
    describe("findConnectRequestById", () => {
        it("should pull lean description parameters snapshots checking only mentee and mentor indices properties", async () => {
            const menteeUser = await makeUser({ name: "Mentee User", roles: ["mentee"] });
            const mentorUser = await makeUser({ name: "Mentor User", roles: ["mentor"] });

            // Uses clean factory to generate authentic schema validation fields effortlessly
            const session = await makeConnectRequest({
                mentee: menteeUser._id,
                mentor: mentorUser._id,
                selectedSlots: [makeSelectedSlot({
                    day: "Monday",
                    date: "2026-06-29",
                    startTime: "09:00",
                    endTime: "10:00"
                })]
            });

            const result = await repo.findConnectRequestById(session._id);

            expect(result).toBeTruthy();
            expect(result.mentee.toString()).toBe(menteeUser._id.toString());
            expect(result.mentor.toString()).toBe(mentorUser._id.toString());
            expect(result.status).toBeUndefined();
        });
    });
});