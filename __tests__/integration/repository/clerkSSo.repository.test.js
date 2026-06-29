const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/clerkSSO.repository");
const { makeUser } = require("../../fixtures/createTestData");
const OAuthAccount = require("../../../models/OAuthAccount"); // Migrated to the real production model wrapper

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Clerk SSO Repository (Integration)", () => {
    describe("findUserByEmail", () => {
        it("should extract matching user files based on lowercase identity strings", async () => {
            await makeUser({
                name: "Clerk User",
                email: "sso@test.com",
                roles: ["mentee"],
            });

            const user = await repo.findUserByEmail("sso@test.com");
            expect(user).toBeTruthy();
            expect(user.name).toBe("Clerk User");
        });
    });

    describe("findOAuthAccount", () => {
        it("should successfully search across composite unique account parameters mappings", async () => {
            const dummyId = new mongoose.Types.ObjectId();
            await OAuthAccount.create({
                user: dummyId,
                provider: "google",
                providerId: "gid_12345",
            });

            const account = await repo.findOAuthAccount("google", "gid_12345");
            expect(account).toBeTruthy();
            expect(account.user.toString()).toBe(dummyId.toString());
        });
    });
});