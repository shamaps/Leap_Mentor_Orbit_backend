const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/upload.repository");
const { makeMentorProfile } = require("../../fixtures/createTestData");

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Upload Repository (Integration)", () => {
    describe("updateMentorProfileDocuments", () => {
        it("should find the document match, merge delta attributes, and return the mutated layout", async () => {
            const mentorUid = new mongoose.Types.ObjectId();
            await makeMentorProfile({ user: mentorUid, phoneNumber: "+1111111" });

            const updated = await repo.updateMentorProfileDocuments(mentorUid, {
                phoneNumber: "+919876543210",
                verificationStatus: "pending",
            });

            expect(updated).toBeTruthy();
            expect(updated.phoneNumber).toBe("+919876543210");
            expect(updated.verificationStatus).toBe("pending");
        });
    });
});