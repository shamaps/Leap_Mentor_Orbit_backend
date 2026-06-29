const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/changePassword.repository");
const { makeUser } = require("../../fixtures/createTestData");

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Change Password Repository (Integration)", () => {
    it("should explicitly select the hidden password column vector string", async () => {
        // Leverages standard factory to cleanly seed accurate User validations and fields
        const createdUser = await makeUser({
            name: "John Test",
            email: "john@test.com",
            password: "database_secret_hash_value",
            roles: ["mentee"]
        });

        // Verify the repository method successfully overrides the schema's default { select: false } behavior
        const repositoryLookup = await repo.findUserWithPassword(createdUser._id);
        expect(repositoryLookup.password).toBe("database_secret_hash_value");
    });
});