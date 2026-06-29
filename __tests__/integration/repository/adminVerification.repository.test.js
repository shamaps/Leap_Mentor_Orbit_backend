/**
 * @fileoverview Integration tests for AdminVerification Repository.
 * Uses MongoMemoryServer for real Mongoose query execution without Atlas.
 */

const mongoose = require("mongoose");
const dbHandler = require("../../utils/db"); // Standardized to use unified project-wide db utility connection
const repo = require("../../../repositories/adminVerification.repository");
const MentorProfile = require("../../../models/MentorProfile");
const { makeMentorProfile } = require("../../fixtures/createTestData");

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("AdminVerification Repository Integration", () => {
    // ── countMentorProfiles ─────────────────────────────────────────────────────
    describe("countMentorProfiles", () => {
        it("should successfully persist and aggregate totals", async () => {
            await makeMentorProfile({
                user: new mongoose.Types.ObjectId(),
                verificationStatus: "unverified",
            });

            const count = await repo.countMentorProfiles({});
            expect(count).toBe(1);
        });

        it("returns 0 when no profiles exist", async () => {
            const count = await repo.countMentorProfiles({});
            expect(count).toBe(0);
        });

        it("filters by verificationStatus correctly", async () => {
            await makeMentorProfile({ user: new mongoose.Types.ObjectId(), verificationStatus: "unverified" });
            await makeMentorProfile({ user: new mongoose.Types.ObjectId(), verificationStatus: "verified" });
            await makeMentorProfile({ user: new mongoose.Types.ObjectId(), verificationStatus: "verified" });

            const verifiedCount = await repo.countMentorProfiles({ verificationStatus: "verified" });
            expect(verifiedCount).toBe(2);

            const unverifiedCount = await repo.countMentorProfiles({ verificationStatus: "unverified" });
            expect(unverifiedCount).toBe(1);
        });

        it("returns correct count after deletion", async () => {
            const profile = await makeMentorProfile({
                user: new mongoose.Types.ObjectId(),
                verificationStatus: "unverified",
            });

            let count = await repo.countMentorProfiles({});
            expect(count).toBe(1);

            await MentorProfile.deleteOne({ _id: profile._id });

            count = await repo.countMentorProfiles({});
            expect(count).toBe(0);
        });
    });

    // ── findMentorProfileById ───────────────────────────────────────────────────
    describe("findMentorProfileById", () => {
        it("returns null for a non-existent ObjectId", async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const result = await repo.findMentorProfileById(fakeId.toString());
            expect(result).toBeNull();
        });
    });

    // ── findMentorProfileDocumentById ───────────────────────────────────────────
    describe("findMentorProfileDocumentById", () => {
        it("returns null for a non-existent ObjectId", async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const result = await repo.findMentorProfileDocumentById(fakeId.toString());
            expect(result).toBeNull();
        });
    });
});