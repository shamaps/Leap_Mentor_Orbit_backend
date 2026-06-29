const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/menteeProfile.repository");
const { makeMenteeProfile } = require("../../fixtures/createTestData"); // Import unified data factories

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Mentee Profile Repository (Integration)", () => {
    describe("findPublicProfileByUser", () => {
        it("should resolve published profile rows while ignoring unverified or unpublished documents", async () => {
            const matchUser = new mongoose.Types.ObjectId();
            const hiddenUser = new mongoose.Types.ObjectId();

            // Seed profiles via centralized factories utilizing authentic production model validations
            await makeMenteeProfile({ user: matchUser, currentRole: "Product Owner", isProfilePublished: true });
            await makeMenteeProfile({ user: hiddenUser, currentRole: "Stealth Dev", isProfilePublished: false });

            const activeProfile = await repo.findPublicProfileByUser(matchUser);
            expect(activeProfile).toBeTruthy();
            expect(activeProfile.currentRole).toBe("Product Owner");

            const hiddenProfile = await repo.findPublicProfileByUser(hiddenUser);
            expect(hiddenProfile).toBeNull();
        });
    });
});