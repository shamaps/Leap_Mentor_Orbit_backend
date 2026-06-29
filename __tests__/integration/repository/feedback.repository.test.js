const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/feedback.repository");
const Feedback = require("../../../models/Feedback"); // Migrated completely to the real production data model

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Feedback Repository (Integration)", () => {
    describe("computeMentorAvgRating", () => {
        it("should aggregate database tables rows to accurately compile numeric averages values", async () => {
            const mentorId = new mongoose.Types.ObjectId();
            const user1 = new mongoose.Types.ObjectId();
            const user2 = new mongoose.Types.ObjectId();

            const dummyRequest1 = new mongoose.Types.ObjectId();
            const dummyRequest2 = new mongoose.Types.ObjectId();

            // Interacts with production schemas ensuring compliance with actual structural constraints
            await Feedback.create([
                { connectRequest: dummyRequest1, to: mentorId, from: user1, fromRole: "mentee", rating: 5, comment: "Wow" },
                { connectRequest: dummyRequest1, to: mentorId, from: user2, fromRole: "mentee", rating: 4, comment: "Good" },
                { connectRequest: dummyRequest2, to: new mongoose.Types.ObjectId(), from: user1, fromRole: "mentor", rating: 1, comment: "Unrelated entry" },
            ]);

            const [aggregationResult] = await repo.computeMentorAvgRating(mentorId);

            expect(aggregationResult).toBeTruthy();
            expect(aggregationResult.avg).toBe(4.5);
            expect(aggregationResult.count).toBe(2);
        });

        it("should return an empty collection gracefully if queries find zero matching scores elements", async () => {
            const activeCheck = await repo.computeMentorAvgRating(new mongoose.Types.ObjectId());
            expect(activeCheck).toHaveLength(0);
        });
    });
});