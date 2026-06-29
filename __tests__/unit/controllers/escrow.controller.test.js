/**
 * @fileoverview Unit tests for Escrow Controller.
 * Targets 100% complete statement, branch, and functional coverage.
 */

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(500).json({ error: err.message, context })),
}));

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json(data)),
}));

const createEscrowController = require("../../../controllers/escrow.controller");
const { handleError } = require("../../../utils/appError");
const { ok } = require("../../../utils/response");

describe("Escrow Controller (100% Comprehensive Coverage)", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = {
            pay: jest.fn(),
            release: jest.fn(),
            refund: jest.fn(),
            getStatus: jest.fn(),
            getMyWallet: jest.fn(),
            payAdditional: jest.fn(),
            getCommissionRate: jest.fn(),
        };

        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createEscrowController(mockService, { logger: mockLogger });

        req = {
            body: {},
            params: {},
            user: { _id: "user_mock_123" },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        jest.clearAllMocks();
    });

    describe("pay endpoint", () => {
        it("should successfully process payment and return standard ok data transport", async () => {
            req.body = { connectRequestId: "cr_1", totalAmount: 110, platformFee: 10 };
            const serviceResult = { totalAmount: 110, platformFee: 10 };
            mockService.pay.mockResolvedValue(serviceResult);

            await controller.pay(req, res);

            expect(mockService.pay).toHaveBeenCalledWith({ connectRequestId: "cr_1", totalAmount: 110, platformFee: 10, menteeId: "user_mock_123" });
            expect(ok).toHaveBeenCalledWith(res, expect.objectContaining({ message: "Payment successful. Tokens locked in escrow.", ...serviceResult }));
        });

        it("should drop into catch block and trigger handleError middleware on service failure rejections", async () => {
            const error = new Error("Insufficient liquidity balance");
            mockService.pay.mockRejectedValue(error);

            await controller.pay(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "Escrow pay");
        });
    });

    describe("release endpoint", () => {
        it("should process fund releases toward mentor on a valid interaction match", async () => {
            req.params.requestId = "cr_1";
            const serviceResult = { totalAmount: 100, mentorPayout: 90, commissionAmount: 10 };
            mockService.release.mockResolvedValue(serviceResult);

            await controller.release(req, res);

            expect(mockService.release).toHaveBeenCalledWith({ requestId: "cr_1", menteeId: "user_mock_123" });
            expect(ok).toHaveBeenCalledWith(res, expect.objectContaining({ message: "Session marked complete. Tokens released to mentor.", ...serviceResult }));
        });

        it("should forward structural throw exceptions straight to error adapters", async () => {
            req.params.requestId = "cr_1";
            const error = new Error("Session status is not ongoing");
            mockService.release.mockRejectedValue(error);

            await controller.release(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "Escrow release");
        });
    });

    describe("refund endpoint", () => {
        it("should complete token reversion operations back to the mentee ledger", async () => {
            req.params.requestId = "cr_1";
            const serviceResult = { totalAmount: 110 };
            mockService.refund.mockResolvedValue(serviceResult);

            await controller.refund(req, res);

            expect(mockService.refund).toHaveBeenCalledWith({ requestId: "cr_1", userId: "user_mock_123" });
            expect(ok).toHaveBeenCalledWith(res, expect.objectContaining({ message: "Escrow refunded successfully. Tokens returned to mentee.", ...serviceResult }));
        });

        it("should invoke standard catch handler on refund service errors", async () => {
            req.params.requestId = "cr_1";
            const error = new Error("Session already finished");
            mockService.refund.mockRejectedValue(error);

            await controller.refund(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "Escrow refund");
        });
    });

    describe("getStatus endpoint", () => {
        it("should gather and transmit summaries layout variables back seamlessly", async () => {
            req.params.requestId = "cr_1";
            const serviceResult = { status: "ongoing", paymentStatus: "paid" };
            mockService.getStatus.mockResolvedValue(serviceResult);

            await controller.getStatus(req, res);

            expect(mockService.getStatus).toHaveBeenCalledWith({ requestId: "cr_1", userId: "user_mock_123" });
            expect(ok).toHaveBeenCalledWith(res, serviceResult);
        });

        it("should forward internal query evaluation failures directly to catch utilities", async () => {
            req.params.requestId = "cr_1";
            const error = new Error("Request row missing");
            mockService.getStatus.mockRejectedValue(error);

            await controller.getStatus(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "Escrow status");
        });
    });

    describe("getMyWallet endpoint", () => {
        it("should extract asset distributions records associated with the profile context signature", async () => {
            const serviceResult = { balance: 500, escrow: 50 };
            mockService.getMyWallet.mockResolvedValue(serviceResult);

            await controller.getMyWallet(req, res);

            expect(mockService.getMyWallet).toHaveBeenCalledWith("user_mock_123");
            expect(ok).toHaveBeenCalledWith(res, serviceResult);
        });

        it("should trigger catch path adapters on missing wallet maps", async () => {
            const error = new Error("Wallet map corrupted");
            mockService.getMyWallet.mockRejectedValue(error);

            await controller.getMyWallet(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "Escrow getMyWallet");
        });
    });

    describe("payAdditional endpoint", () => {
        it("should allocate intermediate escrow parameters rules for standalone slot items", async () => {
            req.body = { connectRequestId: "cr_1", slotId: "s_9" };
            const serviceResult = { totalAmount: 55 };
            mockService.payAdditional.mockResolvedValue(serviceResult);

            await controller.payAdditional(req, res);

            expect(mockService.payAdditional).toHaveBeenCalledWith({ connectRequestId: "cr_1", slotId: "s_9", menteeId: "user_mock_123" });
            expect(ok).toHaveBeenCalledWith(res, expect.objectContaining({ message: "Additional session payment successful. Tokens locked in escrow.", ...serviceResult }));
        });

        it("should map payAdditional failure branches straight into error logs handler", async () => {
            const error = new Error("Slot already paid");
            mockService.payAdditional.mockRejectedValue(error);

            await controller.payAdditional(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "Escrow payAdditional");
        });
    });

    describe("getCommissionRate endpoint", () => {
        it("should pull base system wide baseline cut percentages rules", async () => {
            const serviceResult = { commissionRate: 15 };
            mockService.getCommissionRate.mockResolvedValue(serviceResult);

            await controller.getCommissionRate(req, res);

            expect(mockService.getCommissionRate).toHaveBeenCalled();
            expect(ok).toHaveBeenCalledWith(res, serviceResult);
        });

        it("should throw standard internal exception frames when system configs are unassigned", async () => {
            const error = new Error("Configuration dropped");
            mockService.getCommissionRate.mockRejectedValue(error);

            await controller.getCommissionRate(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "Escrow getCommissionRate");
        });
    });
});