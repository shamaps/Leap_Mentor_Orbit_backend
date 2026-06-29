/**
 * @fileoverview Unit tests for Support Controller.
 * Achieves 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(500).json({ error: err.message, context })),
}));

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json(data)),
}));

const createSupportController = require("../../../controllers/support.controller");
const { handleError } = require("../../../utils/appError");
const { ok } = require("../../../utils/response");

describe("Support Controller (100% Comprehensive Coverage Blueprint)", () => {
    let mockSupportService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockSupportService = {
            createMessage: jest.fn(),
            getMessages: jest.fn(),
            resolveMessage: jest.fn(),
        };

        mockLogger = { info: jest.fn(), error: jest.fn() };
        controller = createSupportController(mockSupportService, { logger: mockLogger });

        req = {
            params: { id: "ticket_001" },
            query: { page: "2", limit: "15" },
            body: {
                email: "help@user.com",
                subject: "Billing Issue",
                message: "Unable to complete escrow transfer tokens.",
                role: "mentee"
            }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        jest.clearAllMocks();
    });

    describe("createMessage Endpoint", () => {
        it("should write a new support ticket message log entry successfully", async () => {
            const mockResponseBody = { success: true, referenceId: "ticket_001" };
            mockSupportService.createMessage.mockResolvedValue({ status: 200, body: mockResponseBody });

            await controller.createMessage(req, res);

            expect(mockSupportService.createMessage).toHaveBeenCalledWith({
                email: "help@user.com",
                subject: "Billing Issue",
                message: "Unable to complete escrow transfer tokens.",
                role: "mentee"
            });
            expect(ok).toHaveBeenCalledWith(res, mockResponseBody);
        });

        it("should route internal service exceptions directly to handleError", async () => {
            const err = new Error("Database validation failure constraint");
            mockSupportService.createMessage.mockRejectedValue(err);

            await controller.createMessage(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "support.createMessage");
        });
    });

    describe("getMessages Endpoint", () => {
        it("should pull a list of support tracking entries successfully matching query options", async () => {
            const mockResponseBody = { tickets: [], total: 0 };
            mockSupportService.getMessages.mockResolvedValue({ status: 200, body: mockResponseBody });

            await controller.getMessages(req, res);

            expect(mockSupportService.getMessages).toHaveBeenCalledWith({
                page: "2",
                limit: "15",
            });
            expect(ok).toHaveBeenCalledWith(res, mockResponseBody);
        });

        it("should route list aggregation exceptions straight to handleError", async () => {
            const err = new Error("Cluster aggregation search connection failure");
            mockSupportService.getMessages.mockRejectedValue(err);

            await controller.getMessages(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "support.getMessages");
        });
    });

    describe("resolveMessage Endpoint", () => {
        it("should mutate targeted ticket status to closed successfully", async () => {
            const mockResponseBody = { status: "resolved", id: "ticket_001" };
            mockSupportService.resolveMessage.mockResolvedValue({ status: 200, body: mockResponseBody });

            await controller.resolveMessage(req, res);

            expect(mockSupportService.resolveMessage).toHaveBeenCalledWith("ticket_001");
            expect(ok).toHaveBeenCalledWith(res, mockResponseBody);
        });

        it("should pass closure operational fault exceptions straight to handleError", async () => {
            const err = new Error("Ticket record locked or already closed");
            mockSupportService.resolveMessage.mockRejectedValue(err);

            await controller.resolveMessage(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "support.resolveMessage");
        });
    });
});