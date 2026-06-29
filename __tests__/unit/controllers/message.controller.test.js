jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createMessageController = require("../../../controllers/message.controller");
const { ok } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Message Controller (Unit)", () => {
    let mockMessageService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockMessageService = {
            getMessages: jest.fn(),
            getUnreadCount: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createMessageController(mockMessageService, { logger: mockLogger });

        req = { params: { connectRequestId: "session_chat_123" }, user: { _id: "user_actor_555" }, query: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("getMessages", () => {
        it("should forward route parameters along with stringified identity frames and invoke standard ok responses", async () => {
            req.query = { limit: "20", page: "2" };
            const serviceResult = { messages: [], pagination: {} };
            mockMessageService.getMessages.mockResolvedValue(serviceResult);

            await controller.getMessages(req, res);

            expect(mockMessageService.getMessages).toHaveBeenCalledWith("session_chat_123", "user_actor_555", req.query);
            expect(ok).toHaveBeenCalledWith(res, serviceResult);
        });

        it("should capture unexpected execution failures and route them to application error helpers", async () => {
            const error = new Error("Dialogue extraction timeout");
            mockMessageService.getMessages.mockRejectedValue(error);

            await controller.getMessages(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "message.getMessages");
        });
    });

    describe("getUnreadCount", () => {
        it("should query the compilation layers and return badge numbers on a 200 envelope", async () => {
            mockMessageService.getUnreadCount.mockResolvedValue({ count: 5 });

            await controller.getUnreadCount(req, res);

            expect(mockMessageService.getUnreadCount).toHaveBeenCalledWith("session_chat_123", "user_actor_555");
            expect(ok).toHaveBeenCalledWith(res, { count: 5 });
        });
    });
});