const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/verification.repository");
const { makeMenteeUser } = require("../../fixtures/createTestData");

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Verification Repository (Integration)", () => {
    describe("markEmailVerified", () => {
        it("should dynamically overwrite account flag properties to confirm user validation states", async () => {
            const targetUser = await makeMenteeUser({
                name: "Verification Target",
                email: "verify_me@test.com",
                isEmailVerified: false
            });

            await repo.markEmailVerified(targetUser);

            const verifiedUser = await mongoose.model("User").findById(targetUser._id);
            expect(verifiedUser.isEmailVerified).toBe(true);
        });
    });
});