/**
 * @fileoverview Integration tests for Admin Payments Repository layer.
 */

const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/adminPayments.repository");
const { makeConnectRequest, makeSelectedSlot } = require("../../fixtures/createTestData");
const Wallet = require("../../../models/Wallet"); // Replaces hand-rolled mini schemas

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Admin Payments Repository (Integration)", () => {
    describe("sumAllWalletEscrows", () => {
        it("should securely sum numeric properties across fragmented entries using Mongo aggregates", async () => {
            await Wallet.create([
                { escrow: 100, user: new mongoose.Types.ObjectId() },
                { escrow: 250, user: new mongoose.Types.ObjectId() },
                { escrow: 0, user: new mongoose.Types.ObjectId() }
            ]);

            const result = await repo.sumAllWalletEscrows();

            expect(result).toBeInstanceOf(Array);
            expect(result[0].total).toBe(350);
        });
    });

    describe("findCompletedPaidSessions", () => {
        it("should filter using compound conditional checks on status parameters", async () => {
            const dummyUserId = new mongoose.Types.ObjectId();
            const dummyMentorId = new mongoose.Types.ObjectId();

            // Leverages authentic top-level paymentStatus validation rule checks ["unpaid", "paid", "refunded"]
            await makeConnectRequest({
                status: "completed",
                paymentStatus: "paid",
                totalAmount: 150,
                commissionAmount: 15,
                mentor: dummyMentorId,
                mentee: dummyUserId,
                selectedSlots: [makeSelectedSlot({ date: "2026-06-30", day: "Monday", startTime: "10:00", endTime: "11:00" })]
            });

            await makeConnectRequest({
                status: "pending",
                paymentStatus: "paid",
                totalAmount: 200,
                commissionAmount: 20,
                mentor: dummyMentorId,
                mentee: dummyUserId,
                selectedSlots: [makeSelectedSlot({ date: "2026-06-30", day: "Monday", startTime: "11:00", endTime: "12:00" })]
            });

            const records = await repo.findCompletedPaidSessions();
            expect(records).toHaveLength(1);
            expect(records[0].totalAmount).toBe(150);
        });
    });
});