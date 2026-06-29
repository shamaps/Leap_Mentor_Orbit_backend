const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/support.repository");
const { makeSupportMessage } = require("../../fixtures/createTestData");

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Support Repository (Integration)", () => {
    describe("findAllMessages", () => {
        it("should retrieve historical ticket rows ordered descending sequentially", async () => {
            // Evaluates messages with valid validation constraints via the central factory layer
            await makeSupportMessage({ email: "a@test.com", subject: "Sub A", createdAt: new Date(Date.now() - 10000) });
            await makeSupportMessage({ email: "b@test.com", subject: "Sub B", createdAt: new Date(Date.now()) });

            const messages = await repo.findAllMessages(0, 10);

            expect(messages).toHaveLength(2);
            expect(messages[0].email).toBe("b@test.com"); // Newest record sorted first
        });
    });
});