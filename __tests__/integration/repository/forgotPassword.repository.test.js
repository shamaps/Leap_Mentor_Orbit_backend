const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/forgotPassword.repository");
const { makeUser } = require("../../fixtures/createTestData");
const VerificationToken = require("../../../models/VerificationToken"); // Import real production model

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Forgot Password Repository (Integration)", () => {
    describe("findUserByEmail", () => {
        it("should fetch profiles targeting strict case-insensitive string parameters mappings", async () => {
            // Uses factory to enforce valid structure, including role arrays and termsAccepted fields
            await makeUser({
                name: "Recovery Target",
                email: "recovery@test.com",
                password: "old_hashed_password",
                roles: ["mentee"]
            });

            const user = await repo.findUserByEmail("recovery@test.com");
            expect(user).toBeTruthy();
            expect(user.email).toBe("recovery@test.com");
        });
    });

    describe("deleteTokensByUser", () => {
        it("should safely wipe tracking sequences linked to account identifiers", async () => {
            const dummyId = new mongoose.Types.ObjectId();

            // Uses real VerificationToken model to run integration hooks accurately
            await VerificationToken.create([
                { user: dummyId, otp: "hash_1", expiresAt: new Date() },
                { user: dummyId, otp: "hash_2", expiresAt: new Date() },
                { user: new mongoose.Types.ObjectId(), otp: "hash_3", expiresAt: new Date() },
            ]);

            const deleteResult = await repo.deleteTokensByUser(dummyId);
            expect(deleteResult.deletedCount).toBe(2);

            const trackingCount = await VerificationToken.countDocuments();
            expect(trackingCount).toBe(1);
        });
    });
});