const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/userSearch.repository");
const { makeMentorUser, makeMenteeUser } = require("../../fixtures/createTestData");

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("User Search Repository (Integration)", () => {
    describe("findUsersByName fallback", () => {
        it("should fallback cleanly to regex search filters when the Atlas service index is uninitialized", async () => {
            // Uses unified factories confirming proper role validations and structural array bounds natively
            await makeMentorUser({ name: "John Orbit Senior", email: "john@orbit.com", isDeleted: false });
            await makeMenteeUser({ name: "John Mentee Junior", email: "john.j@orbit.com", isDeleted: false });
            await makeMentorUser({ name: "John Hidden", email: "john.h@orbit.com", isDeleted: true });

            const matches = await repo.findUsersByName("John", { roles: ["mentor"], includeDeleted: false, limit: 10 });

            expect(matches).toHaveLength(1);
            expect(matches[0].name).toBe("John Orbit Senior");
            expect(matches[0]).not.toHaveProperty("isDeleted");
        });

        it("should short-circuit back an empty array if query input term is missing or spaces-only", async () => {
            const results = await repo.findUsersByName("   ");
            expect(results).toEqual([]);
        });
    });
});