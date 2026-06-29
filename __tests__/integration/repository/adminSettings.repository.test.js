/**
 * @fileoverview Integration tests for Admin Settings Repository layer.
 */

const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/adminSettings.repository");
const { makeConnectRequest, makeSelectedSlot, makeAdminUser } = require("../../fixtures/createTestData");

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Admin Settings Repository (Integration)", () => {
    let dummyUserId, dummyMentorId;

    beforeEach(() => {
        dummyUserId = new mongoose.Types.ObjectId();
        dummyMentorId = new mongoose.Types.ObjectId();
    });

    describe("countActiveSessions", () => {
        it("should securely capture documents limited strictly to ongoing status indicators", async () => {
            const validSlot = makeSelectedSlot({ date: "2026-06-30", day: "Monday", startTime: "10:00", endTime: "11:00" });
            const basePayload = {
                mentor: dummyMentorId,
                mentee: dummyUserId,
                selectedSlots: [validSlot],
            };

            await makeConnectRequest({ status: "ongoing", ...basePayload });
            await makeConnectRequest({ status: "ongoing", ...basePayload });
            await makeConnectRequest({ status: "completed", ...basePayload });
            await makeConnectRequest({ status: "pending", ...basePayload });

            const activeCount = await repo.countActiveSessions();
            expect(activeCount).toBe(2);
        });
    });

    describe("updateCommissionRate", () => {
        it("should properly modify individual record keys inside the storage schema layer", async () => {
            // Uses clean, production-accurate factories fending off validation drop-outs on missing required password fields
            const targetAdmin = await makeAdminUser({
                name: "Admin Test",
                email: "test@admin.com",
                password: "hashed_test_password_123",
                commissionRate: 10
            });

            await repo.updateCommissionRate(targetAdmin._id, 18);

            const modifiedRecord = await mongoose.model("AdminUser").findById(targetAdmin._id).lean();
            expect(modifiedRecord.commissionRate).toBe(18);
        });
    });
});