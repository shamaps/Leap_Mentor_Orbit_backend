const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/register.repository");
const { makeUser } = require("../../fixtures/createTestData");

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Register Repository (Integration)", () => {
    describe("findUserByEmail", () => {
        it("should retrieve onboarding profile records matching explicit lowercase query inputs", async () => {
            // Evaluates registrations accurately against real User schema constraints using factories
            await makeUser({
                name: "Onboard Tester",
                email: "onboard@test.com",
                password: "hashed_password_mock",
                roles: ["mentee"],
            });

            const user = await repo.findUserByEmail("onboard@test.com");

            expect(user).toBeTruthy();
            expect(user.name).toBe("Onboard Tester");
            expect(user.roles).toContain("mentee");
        });
    });
});