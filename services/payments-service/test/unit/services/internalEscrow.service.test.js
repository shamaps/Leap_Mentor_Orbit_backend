/**
 * @fileoverview Unit tests for the Internal Escrow Service (hold, release, refundSlot).
 * Money movement that used to live in escrow.service now lives here and is called
 * by the engagement service, so the ledger rules are covered at this layer.
 */

const { createInternalEscrowService, operationKey, buildSlots } = require("../../../src/services/internalEscrow.service");

const makeEscrow = (overrides = {}) => ({
    requestId: "req_1",
    mentee: "mentee_1",
    mentor: "mentor_1",
    sessionCount: 2,
    totalAmount: 220,
    commissionRate: 10,
    commissionAmount: 20,
    mentorPayout: 200,
    status: "held",
    operations: [],
    refunds: [],
    slots: buildSlots(2, 220, 20, 200),
    ...overrides,
});

describe("Internal Escrow Service", () => {
    let repo, logger, service, menteeWallet, mentorWallet;

    beforeEach(() => {
        menteeWallet = { balance: 1000, escrow: 220 };
        mentorWallet = { balance: 50, escrow: 0 };
        repo = {
            findEscrow: jest.fn().mockResolvedValue(null),
            createEscrow: jest.fn().mockResolvedValue({}),
            saveEscrow: jest.fn().mockResolvedValue({}),
            findWallet: jest.fn(async (id) => (id === "mentor_1" ? mentorWallet : menteeWallet)),
            saveWallet: jest.fn().mockResolvedValue({}),
            insertTransactions: jest.fn().mockResolvedValue([]),
            findActiveAdmin: jest.fn().mockResolvedValue({ commissionRate: 10 }),
            creditPlatformWallet: jest.fn().mockResolvedValue({}),
        };
        logger = { info: jest.fn() };
        // run the callback directly; the real transaction wrapper is not under test here
        service = createInternalEscrowService(repo, { transaction: (fn) => fn("tx_session"), logger });
    });

    describe("helpers", () => {
        it("builds idempotency keys per operation kind", () => {
            expect(operationKey("r", "hold")).toBe("r:hold");
            expect(operationKey("r", "release")).toBe("r:release");
            expect(operationKey("r", "refund", 2)).toBe("r:2:refund");
        });

        it("splits amounts across slots so the parts add up exactly", () => {
            const slots = buildSlots(3, 100, 10, 90);
            expect(slots).toHaveLength(3);
            expect(slots.reduce((s, x) => s + x.totalAmount, 0)).toBeCloseTo(100, 2);
            expect(slots.reduce((s, x) => s + x.commissionAmount, 0)).toBeCloseTo(10, 2);
            expect(slots.every((x) => x.status === "held")).toBe(true);
        });
    });

    describe("hold", () => {
        const input = { requestId: "req_1", menteeId: "mentee_1", mentorId: "mentor_1", sessionRate: 100, sessionCount: 2 };

        it("moves funds from balance to escrow, creates the escrow and writes a ledger entry", async () => {
            menteeWallet = { balance: 1000, escrow: 0 };
            const res = await service.hold(input);

            expect(res).toMatchObject({ totalAmount: 220, commissionAmount: 20, mentorPayout: 200, balance: 780, escrow: 220, paymentStatus: "paid" });
            expect(repo.saveWallet).toHaveBeenCalledWith(menteeWallet, "tx_session");
            expect(repo.createEscrow).toHaveBeenCalledWith(expect.objectContaining({ status: "held", sessionCount: 2, slots: expect.any(Array) }), "tx_session");
            expect(repo.insertTransactions).toHaveBeenCalledWith([expect.objectContaining({ type: "escrow_hold", amount: 220, idempotencyKey: "req_1:hold:ledger" })], "tx_session");
        });

        it("falls back to the default commission when no active admin is configured", async () => {
            menteeWallet = { balance: 1000, escrow: 0 };
            repo.findActiveAdmin.mockResolvedValue(null);
            const res = await service.hold(input);
            expect(res.commissionRate).toBeDefined();
        });

        it("rejects invalid rates or counts with 422 before touching any wallet", async () => {
            await expect(service.hold({ ...input, sessionRate: 0 })).rejects.toMatchObject({ status: 422 });
            await expect(service.hold({ ...input, sessionCount: 1.5 })).rejects.toMatchObject({ status: 422 });
            expect(repo.findWallet).not.toHaveBeenCalled();
        });

        it("fails with 404 when the wallet is missing and 422 when the balance is too low", async () => {
            repo.findWallet.mockResolvedValueOnce(null);
            await expect(service.hold(input)).rejects.toMatchObject({ status: 404 });

            menteeWallet = { balance: 10, escrow: 0 };
            repo.findWallet.mockResolvedValueOnce(menteeWallet);
            await expect(service.hold(input)).rejects.toMatchObject({ status: 422, message: expect.stringContaining("Insufficient balance") });
            expect(repo.createEscrow).not.toHaveBeenCalled();
        });

        it("returns the saved result for a repeated hold with the same input (idempotent)", async () => {
            const saved = { totalAmount: 220, paymentStatus: "paid" };
            const fingerprint = JSON.stringify({ menteeId: "mentee_1", mentorId: "mentor_1", sessionRate: 100, sessionCount: 2 });
            repo.findEscrow.mockResolvedValue(makeEscrow({ operations: [{ key: "req_1:hold", fingerprint, result: saved }] }));

            await expect(service.hold(input)).resolves.toBe(saved);
            expect(repo.saveWallet).not.toHaveBeenCalled();
        });

        it("rejects the same key with different input (409), and a second hold on an existing escrow (409)", async () => {
            repo.findEscrow.mockResolvedValue(makeEscrow({ operations: [{ key: "req_1:hold", fingerprint: "other", result: {} }] }));
            await expect(service.hold(input)).rejects.toMatchObject({ status: 409 });

            repo.findEscrow.mockResolvedValue(makeEscrow());
            await expect(service.hold(input)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("already exists") });
        });

        it("joins an existing session instead of opening a new transaction", async () => {
            menteeWallet = { balance: 1000, escrow: 0 };
            const transaction = jest.fn();
            service = createInternalEscrowService(repo, { transaction, logger });
            await service.hold(input, { session: "outer_session" });
            expect(transaction).not.toHaveBeenCalled();
            expect(repo.findEscrow).toHaveBeenCalledWith("req_1", "outer_session");
        });
    });

    describe("release", () => {
        it("pays the mentor, credits the platform commission and settles the escrow", async () => {
            const escrow = makeEscrow();
            repo.findEscrow.mockResolvedValue(escrow);

            const res = await service.release({ requestId: "req_1", menteeId: "mentee_1" });

            expect(res).toMatchObject({ status: "completed", totalAmount: 220, commissionAmount: 20, mentorPayout: 200, menteeEscrow: 0 });
            expect(mentorWallet.balance).toBe(250);
            expect(repo.creditPlatformWallet).toHaveBeenCalledWith(20, "tx_session");
            expect(escrow.status).toBe("released");
            expect(escrow.slots.every((s) => s.status === "released")).toBe(true);
            expect(repo.insertTransactions.mock.calls[0][0].map((t) => t.type)).toEqual(["escrow_release", "commission_deduct", "mentor_payout"]);
        });

        it("only lets the mentee confirm, and only once", async () => {
            repo.findEscrow.mockResolvedValue(null);
            await expect(service.release({ requestId: "req_1", menteeId: "mentee_1" })).rejects.toMatchObject({ status: 404 });

            repo.findEscrow.mockResolvedValue(makeEscrow());
            await expect(service.release({ requestId: "req_1", menteeId: "attacker" })).rejects.toMatchObject({ status: 403 });

            repo.findEscrow.mockResolvedValue(makeEscrow({ status: "released" }));
            await expect(service.release({ requestId: "req_1", menteeId: "mentee_1" })).rejects.toMatchObject({ status: 409 });
            expect(repo.creditPlatformWallet).not.toHaveBeenCalled();
        });

        it("fails when nothing is left held, wallets are missing, or escrow funds fall short", async () => {
            repo.findEscrow.mockResolvedValue(makeEscrow({ slots: buildSlots(2, 220, 20, 200).map((s) => ({ ...s, status: "refunded" })) }));
            await expect(service.release({ requestId: "req_1", menteeId: "mentee_1" })).rejects.toMatchObject({ status: 409 });

            repo.findEscrow.mockResolvedValue(makeEscrow());
            repo.findWallet.mockResolvedValue(null);
            await expect(service.release({ requestId: "req_1", menteeId: "mentee_1" })).rejects.toMatchObject({ status: 404 });

            repo.findWallet.mockImplementation(async (id) => (id === "mentor_1" ? mentorWallet : { balance: 0, escrow: 10 }));
            await expect(service.release({ requestId: "req_1", menteeId: "mentee_1" })).rejects.toMatchObject({ status: 422 });
        });

        it("releases only what is left after an earlier refund, with the commission scaled down", async () => {
            const escrow = makeEscrow({ refunds: [{ slotIndex: 0, amount: 110 }] });
            escrow.slots[0].status = "refunded";
            repo.findEscrow.mockResolvedValue(escrow);

            const res = await service.release({ requestId: "req_1", menteeId: "mentee_1" });
            expect(res).toMatchObject({ totalAmount: 110, commissionAmount: 10, mentorPayout: 100 });
        });

        it("returns the saved result when the release was already recorded", async () => {
            const fingerprint = JSON.stringify({ menteeId: "mentee_1" });
            const saved = { status: "completed" };
            repo.findEscrow.mockResolvedValue(makeEscrow({ operations: [{ key: "req_1:release", fingerprint, result: saved }] }));
            await expect(service.release({ requestId: "req_1", menteeId: "mentee_1" })).resolves.toBe(saved);
        });

        it("builds slots on the fly for a legacy escrow that has none", async () => {
            const escrow = makeEscrow({ slots: [] });
            repo.findEscrow.mockResolvedValue(escrow);
            await service.release({ requestId: "req_1" });
            expect(escrow.status).toBe("released");
        });
    });

    describe("refundSlot", () => {
        it("refunds one slot back to the mentee balance and marks the escrow partially refunded", async () => {
            const escrow = makeEscrow();
            repo.findEscrow.mockResolvedValue(escrow);

            const res = await service.refundSlot({ requestId: "req_1", slotIndex: 0, cancelledBy: "mentor" });

            expect(res).toMatchObject({ slotIndex: 0, refundedAmount: 110, balance: 1110, escrow: 110, escrowStatus: "partially_refunded" });
            expect(escrow.slots[0].status).toBe("refunded");
            expect(repo.insertTransactions).toHaveBeenCalledWith([expect.objectContaining({ type: "escrow_refund", amount: 110 })], "tx_session");
        });

        it("refunds the remainder when the last held slot is cancelled and marks the escrow refunded", async () => {
            const escrow = makeEscrow({ refunds: [{ slotIndex: 0, amount: 110 }] });
            escrow.slots[0].status = "refunded";
            menteeWallet = { balance: 1110, escrow: 110 };
            repo.findEscrow.mockResolvedValue(escrow);

            const res = await service.refundSlot({ requestId: "req_1", slotIndex: 1 });
            expect(res.refundedAmount).toBe(110);
            expect(escrow.status).toBe("refunded");
        });

        it("finds a slot by slotId and returns the earlier result for a slot refunded already", async () => {
            const escrow = makeEscrow();
            escrow.slots[1].slotId = "slot_b";
            escrow.refunds = [{ slotIndex: 1, amount: 110, result: { refundedAmount: 110, again: true } }];
            repo.findEscrow.mockResolvedValue(escrow);

            const res = await service.refundSlot({ requestId: "req_1", slotId: "slot_b" });
            expect(res).toMatchObject({ again: true });
            expect(repo.saveWallet).not.toHaveBeenCalled();
        });

        it("rejects unknown, settled or no-longer-held slots and missing escrow", async () => {
            repo.findEscrow.mockResolvedValue(null);
            await expect(service.refundSlot({ requestId: "req_1", slotIndex: 0 })).rejects.toMatchObject({ status: 404 });

            repo.findEscrow.mockResolvedValue(makeEscrow());
            await expect(service.refundSlot({ requestId: "req_1", slotIndex: 9 })).rejects.toMatchObject({ status: 422 });

            repo.findEscrow.mockResolvedValue(makeEscrow({ status: "released" }));
            await expect(service.refundSlot({ requestId: "req_1", slotIndex: 0 })).rejects.toMatchObject({ status: 409 });

            const escrow = makeEscrow();
            escrow.slots[0].status = "released";
            repo.findEscrow.mockResolvedValue(escrow);
            await expect(service.refundSlot({ requestId: "req_1", slotIndex: 0 })).rejects.toMatchObject({ status: 409 });
        });

        it("fails safely when the wallet is missing or its escrow is too low", async () => {
            repo.findEscrow.mockResolvedValue(makeEscrow());
            repo.findWallet.mockResolvedValueOnce(null);
            await expect(service.refundSlot({ requestId: "req_1", slotIndex: 0 })).rejects.toMatchObject({ status: 404 });

            repo.findEscrow.mockResolvedValue(makeEscrow());
            repo.findWallet.mockResolvedValueOnce({ balance: 0, escrow: 5 });
            await expect(service.refundSlot({ requestId: "req_1", slotIndex: 0 })).rejects.toMatchObject({ status: 422 });
        });

        it("skips the extra status lookup when running inside a caller's session", async () => {
            repo.findEscrow.mockResolvedValue(makeEscrow());
            const res = await service.refundSlot({ requestId: "req_1", slotIndex: 0 }, { session: "outer" });
            expect(res.escrowStatus).toBeUndefined();
        });
    });
});
