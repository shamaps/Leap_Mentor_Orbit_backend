const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/googleAuth.repository");
const { makeUser } = require("../../fixtures/createTestData");
const OAuthAccount = require("../../../models/OAuthAccount"); // Import authentic production model

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Google Auth Repository (Integration)", () => {
    describe("findUserByEmail", () => {
        it("should successfully extract matching accounts based on lowercase criteria entries", async () => {
            await makeUser({
                name: "OAuth Tester",
                email: "google.login@test.com",
                roles: ["mentee"],
            });

            const user = await repo.findUserByEmail("google.login@test.com");
            expect(user).toBeTruthy();
            expect(user.name).toBe("OAuth Tester");
        });
    });

    describe("createOAuthAccount", () => {
        it("should write third-party federation maps cleanly using structural inputs", async () => {
            const mockUserId = new mongoose.Types.ObjectId();

            const newLink = await repo.createOAuthAccount(mockUserId, "google", "gsub_101010");
            expect(newLink).toBeTruthy();

            const recordedLink = await OAuthAccount.findOne({ providerId: "gsub_101010" }).lean();
            expect(recordedLink.user.toString()).toBe(mockUserId.toString());
            expect(recordedLink.provider).toBe("google");
        });
    });
});