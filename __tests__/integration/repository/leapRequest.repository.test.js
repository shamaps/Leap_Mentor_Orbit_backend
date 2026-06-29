const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/leapRequest.repository");
const LeapRequest = require("../../../models/LeapRequest"); // Replaces hand-rolled mini schemas

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Leap Request Repository (Integration)", () => {
    describe("findPendingByMentee", () => {
        it("should pull exclusively pending items, sorting chronologically by the newest additions", async () => {
            const targetMentee = new mongoose.Types.ObjectId();

            await LeapRequest.create([
                { mentee: targetMentee, status: "approved" },
                { mentee: targetMentee, status: "pending" },
                { mentee: new mongoose.Types.ObjectId(), status: "pending" },
            ]);

            const match = await repo.findPendingByMentee(targetMentee);

            expect(match).toBeTruthy();
            expect(match.status).toBe("pending");
            expect(match.mentee.toString()).toBe(targetMentee.toString());
        });
    });
});