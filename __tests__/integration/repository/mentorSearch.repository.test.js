const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/mentorSearch.repository");
const { makeMentorUser, makeMenteeUser } = require("../../fixtures/createTestData");

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Mentor Search Repository (Integration)", () => {
    describe("findMentorUsersByName fallback", () => {
        it("should accurately isolate query rows utilizing the regex fallback pattern when Atlas aggregates fail", async () => {
            // Evaluates case-insensitive query fallbacks with factory-backed schema constraints (single role layout array, termsAccepted boolean)
            await makeMentorUser({ name: "John Doe Mentor", email: "john@leapmentor.com" });
            await makeMenteeUser({ name: "Jane Mentee", email: "jane@leapmentor.com" });
            await makeMentorUser({ name: "Alice Smith", email: "alice@leapmentor.com" });

            // Triggers the repository catch block directly inside the memory server environment
            const matches = await repo.findMentorUsersByName("John");

            expect(matches).toHaveLength(1);
            expect(matches[0]).toHaveProperty("_id");
        });
    });
});