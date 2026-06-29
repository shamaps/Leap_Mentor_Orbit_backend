jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, ...data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createSupportController = require("../../../controllers/support.controller");
const { ok } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Support Controller (Unit)", () => {
    let mockSupportService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockSupportService = {
            createMessage: jest.fn(),
            getMessages: jest.fn(),
            resolveMessage: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createSupportController(mockSupportService, { logger: mockLogger });

        req = { body: {}, query: {}, params: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("createMessage", () => {
        it("should accept support forms payloads and issue status 200 payload responses", async () => {
            req.body = { email: "user@test.com", subject: "Bug report", message: "Broken layout", role: "mentee" };
            mockSupportService.createMessage.mockResolvedValue({ status: 201, body: { success: true } });

            await controller.createMessage(req, res);

            expect(mockSupportService.createMessage).toHaveBeenCalledWith({
                email: "user@test.com",
                subject: "Bug report",
                message: "Broken layout",
                role: "mentee",
            });
            expect(ok).toHaveBeenCalledWith(res, { success: true });
        });

        it("should redirect processing exceptions down into application error utilities", async () => {
            const error = new Error("Database deadlock");
            mockSupportService.createMessage.mockRejectedValue(error);

            await controller.createMessage(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "support.createMessage");
        });
    });

    describe("resolveMessage", () => {
        it("should target primary path parameters keys and trigger ticket status updates", async () => {
            req.params.id = "ticket_777";
            mockSupportService.resolveMessage.mockResolvedValue({ status: 200, body: { status: "resolved" } });

            await controller.resolveMessage(req, res);

            expect(mockSupportService.resolveMessage).toHaveBeenCalledWith("ticket_777");
            expect(ok).toHaveBeenCalledWith(res, { status: "resolved" });
        });
    });
});