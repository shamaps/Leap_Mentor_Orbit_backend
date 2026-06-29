const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/goal.repository");
const Milestone = require("../../../models/Milestone"); // Migrated to the actual production data model

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Goal Repository (Integration)", () => {
    describe("findMilestonesByGoal", () => {
        it("should extract dependent milestones array ordered cleanly by sequence rank variables", async () => {
            const parentGoalId = new mongoose.Types.ObjectId();
            const dummySession = new mongoose.Types.ObjectId();

            // Interacts with production schemas ensuring compliance with active parameters
            await Milestone.create([
                { goal: parentGoalId, connectRequest: dummySession, title: "Step B", order: 2 },
                { goal: parentGoalId, connectRequest: dummySession, title: "Step A", order: 1 },
                { goal: new mongoose.Types.ObjectId(), connectRequest: dummySession, title: "Isolated Step", order: 0 },
            ]);

            const milestones = await repo.findMilestonesByGoal(parentGoalId);

            expect(milestones).toHaveLength(2);
            expect(milestones[0].title).toBe("Step A");
            expect(milestones[1].title).toBe("Step B");
        });
    });
});