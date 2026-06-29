const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const actualRepo = require("../../../repositories/escrow.repository");
const { makeAdminUser, makeUser, makeConnectRequest, makeSelectedSlot } = require("../../fixtures/createTestData");

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Escrow Repository (Integration)", () => {
    describe("creditAdmin", () => {
        it("should increment the corporate administration operational system tracking ledger parameters balance", async () => {
            const activeAdmin = await makeAdminUser({
                name: "Super Platform Admin",
                email: "admin@leapmentor.com",
                password: "secure_admin_password_hash",
                isActive: true,
                walletBalance: 1500,
            });

            await actualRepo.creditAdmin(activeAdmin._id, 350);

            const modifiedAdminRecord = await mongoose.model("AdminUser").findById(activeAdmin._id).lean();
            expect(modifiedAdminRecord.walletBalance).toBe(1850);
        });
    });

    describe("findConnectRequestById", () => {
        it("should pull a targeting request with unpopulated user entities cleanly if references match", async () => {
            const targetId = new mongoose.Types.ObjectId();
            const dummyUser1 = await makeUser({ name: "Alice", email: "alice@test.com", roles: ["mentor"] });
            const dummyUser2 = await makeUser({ name: "Bob", email: "bob@test.com", roles: ["mentee"] });
            const slotsFixture = [makeSelectedSlot({ date: "2026-07-06", day: "Monday", startTime: "09:00", endTime: "10:00" })];

            await makeConnectRequest({
                _id: targetId,
                status: "accepted",
                paymentStatus: "unpaid",
                mentor: dummyUser1._id,
                mentee: dummyUser2._id,
                selectedSlots: slotsFixture,
            });

            const fetchedDocument = await actualRepo.findConnectRequestById(targetId);
            expect(fetchedDocument).toBeTruthy();
            expect(fetchedDocument.status).toBe("accepted");
        });
    });
});