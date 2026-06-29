const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/session.repository");
const { makeUser, makeConnectRequest, makeSelectedSlot } = require("../../fixtures/createTestData");

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Session Repository (Integration)", () => {
    describe("findSessionForRead", () => {
        it("should retrieve a lean object matching the target session with projected fields", async () => {
            const mentorUser = await makeUser({ name: "Mentor Elite", roles: ["mentor"] });
            const menteeUser = await makeUser({ name: "Mentee Active", roles: ["mentee"] });

            const sessionDoc = await makeConnectRequest({
                mentor: mentorUser._id,
                mentee: menteeUser._id,
                status: "ongoing",
                paymentStatus: "paid",
                selectedSlots: [makeSelectedSlot()],
            });

            const leanSession = await repo.findSessionForRead(sessionDoc._id);

            expect(leanSession).toBeTruthy();
            expect(leanSession.status).toBe("ongoing");
            expect(leanSession.paymentStatus).toBe("paid");

            // Confirms .lean() effectively stripped the hydrated document prototype wrapper
            expect(leanSession instanceof mongoose.Document).toBe(false);
        });
    });

    describe("findSessionPopulated", () => {
        it("should populate original mentor and mentee profiles with selected fields constraints", async () => {
            const mentorUser = await makeUser({ name: "Alex Populated", roles: ["mentor"] });
            const menteeUser = await makeUser({ name: "Bob Populated", roles: ["mentee"] });

            const sessionDoc = await makeConnectRequest({
                mentor: mentorUser._id,
                mentee: menteeUser._id,
            });

            const populatedSession = await repo.findSessionPopulated(sessionDoc._id);

            expect(populatedSession).toBeTruthy();
            expect(populatedSession.mentor.name).toBe("Alex Populated");
            expect(populatedSession.mentee.email).toBe(menteeUser.email);
        });
    });
});