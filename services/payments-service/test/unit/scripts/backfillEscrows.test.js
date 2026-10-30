/**
 * @fileoverview Unit tests for the pure parts of the escrow backfill script:
 * building an Escrow record from a ConnectRequest + ledger, and reconciling the ledger first.
 * (The script only connects to MongoDB when run directly, so importing it here is safe.)
 */

const { buildEscrowRecord, reconcileLedger } = require("../../../src/scripts/backfillEscrows");

const REQ_ID = "1".repeat(24);
const MENTEE = "2".repeat(24);
const MENTOR = "3".repeat(24);
const PAID_AT = new Date("2026-01-10T09:00:00Z");
const COMPLETED_AT = new Date("2026-02-01T09:00:00Z");

// 2 sessions x 100 + 10 commission = 210 total, mentor gets 200.
const makeRequest = (over = {}) => ({
    _id: REQ_ID,
    mentee: MENTEE,
    mentor: MENTOR,
    sessionRate: 100,
    sessionCount: 2,
    totalAmount: 210,
    commissionRate: 5,
    commissionAmount: 10,
    mentorPayout: 200,
    paymentStatus: "paid",
    status: "accepted",
    paidAt: PAID_AT,
    ...over,
});

const entry = (type, amount, extra = {}) => ({ type, amount, ...extra });
const hold = (amount = 210) => entry("escrow_hold", amount);
const slotRefund = (slotNumber, amount, extra = {}) =>
    entry("escrow_refund", amount, { description: `Slot #${slotNumber} cancelled - refund`, ...extra });

describe("buildEscrowRecord", () => {
    describe("held escrow", () => {
        it("should copy the financial snapshot from the request", () => {
            const record = buildEscrowRecord(makeRequest(), [hold()]);

            expect(record).toMatchObject({
                requestId: REQ_ID,
                mentee: MENTEE,
                mentor: MENTOR,
                sessionRate: 100,
                sessionCount: 2,
                totalAmount: 210,
                commissionRate: 5,
                commissionAmount: 10,
                mentorPayout: 200,
                status: "held",
                heldAt: PAID_AT,
                releasedAt: null,
                refunds: [],
            });
        });

        it("should create one held slot per session with an even split", () => {
            const { slots } = buildEscrowRecord(makeRequest(), [hold()]);

            expect(slots).toHaveLength(2);
            expect(slots[0]).toMatchObject({ slotIndex: 0, totalAmount: 105, commissionAmount: 5, mentorPayout: 100, status: "held" });
            expect(slots[1]).toMatchObject({ slotIndex: 1, totalAmount: 105, commissionAmount: 5, mentorPayout: 100, status: "held" });
        });

        it("should record only the hold operation, keyed by request id", () => {
            const { operations } = buildEscrowRecord(makeRequest(), [hold()]);

            expect(operations).toHaveLength(1);
            expect(operations[0]).toMatchObject({
                key: `${REQ_ID}:hold`,
                kind: "hold",
                completedAt: PAID_AT,
                result: {
                    requestId: REQ_ID,
                    totalAmount: 210,
                    commissionRate: 5,
                    commissionAmount: 10,
                    mentorPayout: 200,
                    migrated: true,
                    paymentStatus: "paid",
                },
            });
        });

        it("should give the rounding remainder to the last slot so slot totals add up exactly", () => {
            const request = makeRequest({ sessionCount: 3, totalAmount: 100, commissionAmount: 10, mentorPayout: 90 });

            const { slots } = buildEscrowRecord(request, [hold(100)]);

            expect(slots.map((s) => s.totalAmount)).toEqual([33.33, 33.33, 33.34]);
            expect(slots.map((s) => s.commissionAmount)).toEqual([3.33, 3.33, 3.34]);
            expect(slots.map((s) => s.mentorPayout)).toEqual([30, 30, 30]);
        });

        it("should derive the mentor payout from total minus commission when it was not stored", () => {
            const record = buildEscrowRecord(makeRequest({ mentorPayout: undefined }), [hold()]);

            expect(record.mentorPayout).toBe(200);
        });

        it("should link slots to the request's selected slot ids when present", () => {
            const request = makeRequest({ selectedSlots: [{ _id: "slotA" }, { _id: "slotB" }] });

            const { slots } = buildEscrowRecord(request, [hold()]);

            expect(slots.map((s) => s.slotId)).toEqual(["slotA", "slotB"]);
        });

        it("should leave slotId null when the request has no selected slots", () => {
            const { slots } = buildEscrowRecord(makeRequest(), [hold()]);

            expect(slots.map((s) => s.slotId)).toEqual([null, null]);
        });
    });

    describe("held time fallbacks", () => {
        it("should fall back to createdAt when paidAt is missing", () => {
            const createdAt = new Date("2026-01-01T00:00:00Z");

            const record = buildEscrowRecord(makeRequest({ paidAt: undefined, createdAt }), [hold()]);

            expect(record.heldAt).toBe(createdAt);
        });

        it("should fall back to the epoch when no date is available", () => {
            const record = buildEscrowRecord(makeRequest({ paidAt: undefined }), [hold()]);

            expect(record.heldAt).toEqual(new Date(0));
        });
    });

    describe("additional paid slots", () => {
        const additionalSlots = [
            { _id: "extra1", paymentStatus: "paid", totalAmount: 52.5, sessionRate: 50 },
            { _id: "extra2", paymentStatus: "unpaid", totalAmount: 99, sessionRate: 90 },
        ];

        it("should add paid extra slots to the totals and ignore unpaid ones", () => {
            const record = buildEscrowRecord(makeRequest({ additionalSlots }), [hold(262.5)]);

            expect(record.sessionCount).toBe(3);
            expect(record.totalAmount).toBe(262.5);
            expect(record.commissionAmount).toBe(12.5);
            expect(record.mentorPayout).toBe(250);
        });

        it("should append a held slot for each paid extra slot", () => {
            const { slots } = buildEscrowRecord(makeRequest({ additionalSlots }), [hold(262.5)]);

            expect(slots).toHaveLength(3);
            expect(slots[2]).toMatchObject({
                slotIndex: 2, slotId: "extra1", totalAmount: 52.5, commissionAmount: 2.5, mentorPayout: 50, status: "held",
            });
        });
    });

    describe("refunds", () => {
        it("should turn a slot refund into a refund entry and mark only that slot refunded", () => {
            const ledger = [hold(), slotRefund(2, 105, { idempotencyKey: "refund-key-1", createdAt: COMPLETED_AT })];

            const record = buildEscrowRecord(makeRequest(), ledger);

            expect(record.status).toBe("partially_refunded");
            expect(record.refunds).toEqual([{
                slotIndex: 1,
                amount: 105,
                key: "refund-key-1",
                cancelledBy: "migration",
                result: { requestId: REQ_ID, slotIndex: 1, refundedAmount: 105, migrated: true },
                completedAt: COMPLETED_AT,
            }]);
            expect(record.slots[0].status).toBe("held");
            expect(record.slots[1].status).toBe("refunded");
        });

        it("should build a refund key from the request id and slot when the ledger row has none", () => {
            const record = buildEscrowRecord(makeRequest(), [hold(), slotRefund(1, 105)]);

            expect(record.refunds[0].key).toBe(`${REQ_ID}:0:refund`);
            expect(record.refunds[0].completedAt).toBe(PAID_AT);
        });

        it("should ignore refund rows that do not name a slot", () => {
            const ledger = [hold(), entry("escrow_refund", 50, { description: "Goodwill refund" })];

            const record = buildEscrowRecord(makeRequest(), ledger);

            expect(record.refunds).toEqual([]);
            expect(record.status).toBe("held");
        });

        it("should mark the whole escrow refunded when the request was refunded", () => {
            const ledger = [hold(), slotRefund(1, 105), slotRefund(2, 105)];

            const record = buildEscrowRecord(makeRequest({ paymentStatus: "refunded" }), ledger);

            expect(record.status).toBe("refunded");
            expect(record.slots.every((s) => s.status === "refunded")).toBe(true);
            expect(record.operations.map((o) => o.kind)).toEqual(["hold", "refund"]);
            expect(record.operations[1]).toMatchObject({
                key: `${REQ_ID}:refund`,
                result: { requestId: REQ_ID, totalAmount: 210, paymentStatus: "refunded", migrated: true },
            });
            expect(record.releasedAt).toBeNull();
        });
    });

    describe("released escrow", () => {
        const releaseLedger = [
            hold(),
            entry("escrow_release", 210),
            entry("commission_deduct", 10),
            entry("mentor_payout", 200),
        ];

        it("should be released with a release operation built from the ledger totals", () => {
            const request = makeRequest({ status: "completed", completedAt: COMPLETED_AT });

            const record = buildEscrowRecord(request, releaseLedger);

            expect(record.status).toBe("released");
            expect(record.releasedAt).toBe(COMPLETED_AT);
            expect(record.slots.every((s) => s.status === "released")).toBe(true);
            expect(record.operations.map((o) => o.kind)).toEqual(["hold", "release"]);
            expect(record.operations[1]).toMatchObject({
                key: `${REQ_ID}:release`,
                completedAt: COMPLETED_AT,
                result: {
                    requestId: REQ_ID,
                    totalAmount: 210,
                    commissionRate: 5,
                    commissionAmount: 10,
                    mentorPayout: 200,
                    status: "completed",
                    migrated: true,
                },
            });
        });

        it("should keep a previously refunded slot refunded when the rest was released", () => {
            const request = makeRequest({ status: "completed", completedAt: COMPLETED_AT });

            const record = buildEscrowRecord(request, [...releaseLedger, slotRefund(2, 105)]);

            expect(record.status).toBe("released");
            expect(record.slots[0].status).toBe("released");
            expect(record.slots[1].status).toBe("refunded");
        });

        it("should prefer refunded over released when the payment was refunded", () => {
            const request = makeRequest({ status: "completed", paymentStatus: "refunded" });

            const record = buildEscrowRecord(request, [hold(), slotRefund(1, 105), slotRefund(2, 105)]);

            expect(record.status).toBe("refunded");
        });
    });
});

describe("reconcileLedger", () => {
    it("should accept a paid request whose holds match the total", () => {
        expect(reconcileLedger(makeRequest(), [hold()])).toEqual([]);
    });

    it("should report holds that do not match the request total", () => {
        const errors = reconcileLedger(makeRequest(), [hold(200)]);

        expect(errors).toEqual(["ledger holds (200) do not reconcile with request total (210)"]);
    });

    it("should tolerate a rounding difference of up to 0.02 on holds", () => {
        expect(reconcileLedger(makeRequest(), [hold(210.01)])).toEqual([]);
        expect(reconcileLedger(makeRequest(), [hold(210.05)])).toHaveLength(1);
    });

    it("should count paid additional slots toward the expected hold", () => {
        const request = makeRequest({
            additionalSlots: [{ paymentStatus: "paid", totalAmount: 52.5, sessionRate: 50 }],
        });

        expect(reconcileLedger(request, [hold(262.5)])).toEqual([]);
        expect(reconcileLedger(request, [hold(210)])).toEqual([
            "ledger holds (210) do not reconcile with request total (262.5)",
        ]);
    });

    describe("settled requests", () => {
        it("should require refunds to add up to the holds on a refunded request", () => {
            const request = makeRequest({ paymentStatus: "refunded" });

            expect(reconcileLedger(request, [hold(), slotRefund(1, 105), slotRefund(2, 105)])).toEqual([]);
            expect(reconcileLedger(request, [hold(), slotRefund(1, 100)])).toEqual([
                "settled ledger total (100) does not reconcile with holds (210)",
            ]);
        });

        it("should require releases to add up to the holds on a completed request", () => {
            const request = makeRequest({ status: "completed" });

            expect(reconcileLedger(request, [hold(), entry("escrow_release", 210)])).toEqual([]);
            expect(reconcileLedger(request, [hold(), entry("escrow_release", 100)])).toEqual([
                "settled ledger total (100) does not reconcile with holds (210)",
            ]);
        });

        it("should count refunds and releases together", () => {
            const request = makeRequest({ status: "completed" });
            const ledger = [hold(), slotRefund(2, 105), entry("escrow_release", 105)];

            expect(reconcileLedger(request, ledger)).toEqual([]);
        });

        it("should allow a 0.05 rounding difference on settlement", () => {
            const request = makeRequest({ status: "completed" });

            expect(reconcileLedger(request, [hold(), entry("escrow_release", 209.96)])).toEqual([]);
            expect(reconcileLedger(request, [hold(), entry("escrow_release", 209.9)])).toHaveLength(1);
        });

        it("should not check settlement for a request that is still held", () => {
            expect(reconcileLedger(makeRequest(), [hold(), slotRefund(1, 105)])).toEqual([]);
        });
    });

    describe("refund ledger rows", () => {
        it("should flag a refund row that does not name a slot on a paid request", () => {
            const ledger = [hold(), entry("escrow_refund", 50, { description: "Goodwill refund" })];

            expect(reconcileLedger(makeRequest(), ledger)).toEqual([
                "a paid request has an unclassified refund ledger row",
            ]);
        });

        it("should not flag an unnamed refund row on an already refunded request", () => {
            const request = makeRequest({ paymentStatus: "refunded" });
            const ledger = [hold(), entry("escrow_refund", 210, { description: "Full refund" })];

            expect(reconcileLedger(request, ledger)).toEqual([]);
        });

        it("should flag two refund rows for the same slot", () => {
            const ledger = [hold(), slotRefund(1, 105), slotRefund(1, 105)];

            expect(reconcileLedger(makeRequest(), ledger)).toContain("multiple refund ledger rows identify the same slot");
        });

        it("should flag a refund for a slot outside the paid range", () => {
            const tooHigh = reconcileLedger(makeRequest(), [hold(), slotRefund(3, 105)]);
            const tooLow = reconcileLedger(makeRequest(), [hold(), slotRefund(0, 105)]);

            expect(tooHigh).toContain("a slot refund ledger row references a slot outside the paid session range");
            expect(tooLow).toContain("a slot refund ledger row references a slot outside the paid session range");
        });

        it("should allow a refund for a paid additional slot", () => {
            const request = makeRequest({
                additionalSlots: [{ paymentStatus: "paid", totalAmount: 52.5, sessionRate: 50 }],
            });

            expect(reconcileLedger(request, [hold(262.5), slotRefund(3, 52.5)])).toEqual([]);
        });

        it("should report several problems together", () => {
            const ledger = [hold(100), slotRefund(1, 10), slotRefund(1, 10)];

            const errors = reconcileLedger(makeRequest(), ledger);

            expect(errors).toHaveLength(2);
        });
    });
});