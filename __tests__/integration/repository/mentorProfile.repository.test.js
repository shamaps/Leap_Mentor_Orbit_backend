const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/mentorProfile.repository");
const { makeMentorProfile } = require("../../fixtures/createTestData");

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Mentor Profile Repository (Integration)", () => {
    describe("findPublicProfileByUser", () => {
        it("should pull exclusively active published elements expanding the related account mappings", async () => {
            const matchUser = new mongoose.Types.ObjectId();
            const hiddenUser = new mongoose.Types.ObjectId();

            // Uses clean, production-accurate factories fending off validation drop-outs
            await makeMentorProfile({ user: matchUser, currentRole: "DevOps Engineer", isProfilePublished: true });
            await makeMentorProfile({ user: hiddenUser, currentRole: "Secret Architect", isProfilePublished: false });

            const publicMatch = await repo.findPublicProfileByUser(matchUser);
            expect(publicMatch).toBeTruthy();
            expect(publicMatch.currentRole).toBe("DevOps Engineer");

            const privateMatch = await repo.findPublicProfileByUser(hiddenUser);
            expect(privateMatch).toBeNull();
        });
    });
});