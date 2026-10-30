/**
 * @fileoverview Routing tests for the Payments internal API (called by Engagement only).
 */

const request = require("supertest");
const express = require("express");
const AppError = require("@leapmentor/shared/utils/appError");

const mockInternalEscrowService = {
    hold: jest.fn(),
    release: jest.fn(),
    refundSlot: jest.fn(),
};
const mockWalletOperationsService = {
    getBalance: jest.fn(),
    issueLeapRefill: jest.fn(),
};

jest.mock("../../../src/config/container", () => ({
    internalEscrowService: mockInternalEscrowService,
    walletOperationsService: mockWalletOperationsService,
}));

const internalRoutes = require("../../../src/routes/internal.routes");

const TOKEN = "engagement-to-payments-secret";
const REQ_ID = "a".repeat(24);
const USER_ID = "b".repeat(24);
const MENTEE = "c".repeat(24);
const MENTOR = "d".repeat(24);

const app = express();
app.use(express.json());
app.use("/internal", internalRoutes);

// Adds the credentials Engagement would send.
const asEngagement = (req) => req.set("x-caller-service", "engagement").set("x-internal-token", TOKEN);

let previousToken;
beforeAll(() => {
    previousToken = process.env.ENGAGEMENT_TO_PAYMENTS_TOKEN;
    process.env.ENGAGEMENT_TO_PAYMENTS_TOKEN = TOKEN;
});
afterAll(() => {
    if (previousToken === undefined) delete process.env.ENGAGEMENT_TO_PAYMENTS_TOKEN;
    else process.env.ENGAGEMENT_TO_PAYMENTS_TOKEN = previousToken;
});

describe("Payments Internal Routes (Integration)", () => {
    describe("service-to-service authentication", () => {
        it("should reject a call with no credentials", async () => {
            const res = await request(app).get("/internal/ping");

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should reject a caller that is not on the allow-list", async () => {
            const res = await request(app)
                .get("/internal/ping")
                .set("x-caller-service", "identity")
                .set("x-internal-token", TOKEN);

            expect(res.status).toBe(401);
        });

        it("should reject a wrong token", async () => {
            const res = await request(app)
                .get("/internal/ping")
                .set("x-caller-service", "engagement")
                .set("x-internal-token", "not-the-token");

            expect(res.status).toBe(401);
        });

        it("should answer 503 when the shared secret is not configured on this service", async () => {
            delete process.env.ENGAGEMENT_TO_PAYMENTS_TOKEN;
            try {
                const res = await asEngagement(request(app).get("/internal/ping"));
                expect(res.status).toBe(503);
            } finally {
                process.env.ENGAGEMENT_TO_PAYMENTS_TOKEN = TOKEN;
            }
        });

        it("should accept Engagement with the right token and identify the caller on /ping", async () => {
            const res = await asEngagement(request(app).get("/internal/ping"));

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ success: true, service: "payments", caller: "engagement" });
        });

        it("should not reach any handler when authentication fails", async () => {
            await request(app).post(`/internal/escrows/${REQ_ID}/release`).send({});

            expect(mockInternalEscrowService.release).not.toHaveBeenCalled();
        });
    });

    describe("POST /escrows/:requestId/hold", () => {
        const body = { menteeId: MENTEE, mentorId: MENTOR, sessionRate: 100, sessionCount: 2 };

        it("should hold the escrow and return the service result", async () => {
            mockInternalEscrowService.hold.mockResolvedValue({ totalAmount: 210 });

            const res = await asEngagement(request(app).post(`/internal/escrows/${REQ_ID}/hold`).send(body));

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ success: true, data: { totalAmount: 210 } });
            expect(mockInternalEscrowService.hold).toHaveBeenCalledWith({ requestId: REQ_ID, ...body });
        });

        it("should strip unknown body fields before calling the service", async () => {
            mockInternalEscrowService.hold.mockResolvedValue({});

            await asEngagement(request(app).post(`/internal/escrows/${REQ_ID}/hold`).send({ ...body, isAdmin: true }));

            expect(mockInternalEscrowService.hold.mock.calls[0][0]).not.toHaveProperty("isAdmin");
        });

        it("should reject a malformed request id with 400", async () => {
            const res = await asEngagement(request(app).post("/internal/escrows/not-an-id/hold").send(body));

            expect(res.status).toBe(400);
            expect(res.body.message).toBe("requestId must be a valid MongoDB ObjectId");
            expect(mockInternalEscrowService.hold).not.toHaveBeenCalled();
        });

        it("should reject an invalid body with 400 and list every problem", async () => {
            const res = await asEngagement(request(app)
                .post(`/internal/escrows/${REQ_ID}/hold`)
                .send({ menteeId: "x", sessionRate: 0 }));

            expect(res.status).toBe(400);
            expect(res.body.message).toContain("menteeId");
            expect(res.body.message).toContain("mentorId");
            expect(res.body.message).toContain("sessionCount");
            expect(mockInternalEscrowService.hold).not.toHaveBeenCalled();
        });

        it("should map a service AppError to its status code", async () => {
            mockInternalEscrowService.hold.mockRejectedValue(new AppError(402, "Insufficient Leap Points"));

            const res = await asEngagement(request(app).post(`/internal/escrows/${REQ_ID}/hold`).send(body));

            expect(res.status).toBe(402);
            expect(res.body).toMatchObject({ success: false, message: "Insufficient Leap Points" });
        });

        it("should hide unexpected errors behind a generic 500", async () => {
            mockInternalEscrowService.hold.mockRejectedValue(new Error("mongo exploded"));

            const res = await asEngagement(request(app).post(`/internal/escrows/${REQ_ID}/hold`).send(body));

            expect(res.status).toBe(500);
            expect(res.body.message).toBe("Internal server error");
        });
    });

    describe("POST /escrows/:requestId/release", () => {
        it("should release without a body (menteeId is optional)", async () => {
            mockInternalEscrowService.release.mockResolvedValue({ status: "completed" });

            const res = await asEngagement(request(app).post(`/internal/escrows/${REQ_ID}/release`).send({}));

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual({ status: "completed" });
            expect(mockInternalEscrowService.release).toHaveBeenCalledWith({ requestId: REQ_ID });
        });

        it("should pass the menteeId through when provided", async () => {
            mockInternalEscrowService.release.mockResolvedValue({});

            await asEngagement(request(app).post(`/internal/escrows/${REQ_ID}/release`).send({ menteeId: MENTEE }));

            expect(mockInternalEscrowService.release).toHaveBeenCalledWith({ requestId: REQ_ID, menteeId: MENTEE });
        });

        it("should reject a malformed menteeId and a malformed request id", async () => {
            const badBody = await asEngagement(request(app).post(`/internal/escrows/${REQ_ID}/release`).send({ menteeId: "nope" }));
            const badId = await asEngagement(request(app).post("/internal/escrows/zzz/release").send({}));

            expect(badBody.status).toBe(400);
            expect(badId.status).toBe(400);
            expect(mockInternalEscrowService.release).not.toHaveBeenCalled();
        });

        it("should return 409 when nothing is left to release", async () => {
            mockInternalEscrowService.release.mockRejectedValue(new AppError(409, "Escrow is already settled"));

            const res = await asEngagement(request(app).post(`/internal/escrows/${REQ_ID}/release`).send({}));

            expect(res.status).toBe(409);
            expect(res.body.message).toBe("Escrow is already settled");
        });
    });

    describe("POST /escrows/:requestId/slots/:slotIndex/refund", () => {
        it("should refund the slot with the default cancelledBy of system", async () => {
            mockInternalEscrowService.refundSlot.mockResolvedValue({ refundedAmount: 105 });

            const res = await asEngagement(request(app).post(`/internal/escrows/${REQ_ID}/slots/2/refund`).send({}));

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual({ refundedAmount: 105 });
            expect(mockInternalEscrowService.refundSlot).toHaveBeenCalledWith({
                requestId: REQ_ID, slotIndex: 2, cancelledBy: "system",
            });
        });

        it("should pass cancelledBy and slotId through", async () => {
            mockInternalEscrowService.refundSlot.mockResolvedValue({});
            const slotId = "e".repeat(24);

            await asEngagement(request(app)
                .post(`/internal/escrows/${REQ_ID}/slots/0/refund`)
                .send({ cancelledBy: "mentee", slotId }));

            expect(mockInternalEscrowService.refundSlot).toHaveBeenCalledWith({
                requestId: REQ_ID, slotIndex: 0, cancelledBy: "mentee", slotId,
            });
        });

        it.each(["-1", "abc", "1.5"])("should reject slotIndex %s with 400", async (slotIndex) => {
            const res = await asEngagement(request(app)
                .post(`/internal/escrows/${REQ_ID}/slots/${slotIndex}/refund`)
                .send({}));

            expect(res.status).toBe(400);
            expect(res.body.message).toBe("slotIndex must be a non-negative integer");
            expect(mockInternalEscrowService.refundSlot).not.toHaveBeenCalled();
        });

        it("should reject an over-long cancelledBy with 400", async () => {
            const res = await asEngagement(request(app)
                .post(`/internal/escrows/${REQ_ID}/slots/0/refund`)
                .send({ cancelledBy: "x".repeat(81) }));

            expect(res.status).toBe(400);
        });

        it("should expose the 422 code when the escrow balance is too low", async () => {
            mockInternalEscrowService.refundSlot.mockRejectedValue(new AppError(422, "Escrow balance too low for slot refund. Contact support."));

            const res = await asEngagement(request(app).post(`/internal/escrows/${REQ_ID}/slots/0/refund`).send({}));

            expect(res.status).toBe(422);
            expect(res.body.code).toBe("UNPROCESSABLE");
        });
    });

    describe("GET /wallets/:userId/balance", () => {
        it("should return the wallet balance", async () => {
            mockWalletOperationsService.getBalance.mockResolvedValue({ balance: 40, escrow: 5 });

            const res = await asEngagement(request(app).get(`/internal/wallets/${USER_ID}/balance`));

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ success: true, data: { balance: 40, escrow: 5 } });
            expect(mockWalletOperationsService.getBalance).toHaveBeenCalledWith(USER_ID);
        });

        it("should reject a malformed user id with a userId message", async () => {
            const res = await asEngagement(request(app).get("/internal/wallets/bad/balance"));

            expect(res.status).toBe(400);
            expect(res.body.message).toBe("userId must be a valid MongoDB ObjectId");
        });

        it("should return 404 when the user has no wallet", async () => {
            mockWalletOperationsService.getBalance.mockRejectedValue(new AppError(404, "User not found"));

            const res = await asEngagement(request(app).get(`/internal/wallets/${USER_ID}/balance`));

            expect(res.status).toBe(404);
        });
    });

    describe("POST /wallets/:userId/leap-refills", () => {
        it("should issue the refill and return the service result", async () => {
            mockWalletOperationsService.issueLeapRefill.mockResolvedValue({ userId: USER_ID, amount: 500, balance: 510 });

            const res = await asEngagement(request(app)
                .post(`/internal/wallets/${USER_ID}/leap-refills`)
                .send({ requestId: REQ_ID }));

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual({ userId: USER_ID, amount: 500, balance: 510 });
            expect(mockWalletOperationsService.issueLeapRefill).toHaveBeenCalledWith({ userId: USER_ID, requestId: REQ_ID });
        });

        it("should reject a missing or malformed requestId with 400", async () => {
            const missing = await asEngagement(request(app).post(`/internal/wallets/${USER_ID}/leap-refills`).send({}));
            const malformed = await asEngagement(request(app).post(`/internal/wallets/${USER_ID}/leap-refills`).send({ requestId: "x" }));

            expect(missing.status).toBe(400);
            expect(malformed.status).toBe(400);
            expect(mockWalletOperationsService.issueLeapRefill).not.toHaveBeenCalled();
        });

        it("should reject a malformed user id with 400", async () => {
            const res = await asEngagement(request(app).post("/internal/wallets/bad/leap-refills").send({ requestId: REQ_ID }));

            expect(res.status).toBe(400);
            expect(res.body.message).toBe("userId must be a valid MongoDB ObjectId");
        });

        it("should return 409 when the refill key belongs to another user", async () => {
            mockWalletOperationsService.issueLeapRefill.mockRejectedValue(new AppError(409, "Refill key belongs to a different user"));

            const res = await asEngagement(request(app)
                .post(`/internal/wallets/${USER_ID}/leap-refills`)
                .send({ requestId: REQ_ID }));

            expect(res.status).toBe(409);
        });
    });
});