const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/invoice.repository");
const { makeAdminUser } = require("../../fixtures/createTestData");

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Invoice Repository (Integration)", () => {
    describe("findActiveAdminCommissionRate", () => {
        it("should retrieve operational percentages filtering exactly by active configuration properties flags", async () => {
            // Uses unified real model factory to satisfy all production required validations natively
            await makeAdminUser({ name: "Inactive Admin", email: "old-admin@test.com", password: "securehash1", isActive: false, commissionRate: 15 });
            await makeAdminUser({ name: "Active Admin", email: "current-admin@test.com", password: "securehash2", isActive: true, commissionRate: 12 });

            const match = await repo.findActiveAdminCommissionRate();

            expect(match).toBeTruthy();
            expect(match.commissionRate).toBe(12);
            expect(match).not.toHaveProperty("isActive");
        });
    });
});