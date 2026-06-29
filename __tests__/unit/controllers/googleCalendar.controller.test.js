jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
    noContent: jest.fn((res) => res.status(204).send()),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createGoogleCalendarController = require("../../../controllers/googleCalendar.controller");
const { ok, noContent } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Google Calendar Controller (Unit)", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = {
            getAuthUrl: jest.fn(),
            getStatus: jest.fn(),
            handleCallback: jest.fn(),
            disconnect: jest.fn(),
            getBusySlots: jest.fn(),
            getEvents: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createGoogleCalendarController(mockService, { logger: mockLogger });

        req = { user: { _id: "mentor_abc_123" }, query: {}, params: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
            setHeader: jest.fn(),
        };
        jest.clearAllMocks();
    });

    describe("getAuthUrl", () => {
        it("should fetch redirection setup endpoints and output parameter envelopes", async () => {
            mockService.getAuthUrl.mockResolvedValue("https://accounts.google.com/o/oauth2");

            await controller.getAuthUrl(req, res);

            expect(mockService.getAuthUrl).toHaveBeenCalledWith("mentor_abc_123");
            expect(ok).toHaveBeenCalledWith(res, { url: "https://accounts.google.com/o/oauth2" });
        });
    });

    describe("handleCallback", () => {
        it("should issue postMessage frames with explicit nonce headers on authorization success", async () => {
            req.query = { code: "auth_code_xyz", state: "state_b64" };
            mockService.handleCallback.mockResolvedValue();

            await controller.handleCallback(req, res);

            expect(mockService.handleCallback).toHaveBeenCalledWith("auth_code_xyz", "state_b64");
            expect(res.setHeader).toHaveBeenCalledWith("Content-Security-Policy", expect.stringContaining("script-src 'nonce-"));
            expect(res.send).toHaveBeenCalledWith(expect.stringContaining("GOOGLE_CALENDAR_CONNECTED"));
        });

        it("should emit explicit script payloads to window openers when Google returns rejection parameters", async () => {
            req.query = { error: "access_denied" };

            await controller.handleCallback(req, res);

            expect(mockService.handleCallback).not.toHaveBeenCalled();
            expect(res.send).toHaveBeenCalledWith(expect.stringContaining("GOOGLE_CALENDAR_ERROR"));
        });
    });
});