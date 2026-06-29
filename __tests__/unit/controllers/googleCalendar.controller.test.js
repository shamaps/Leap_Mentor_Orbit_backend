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

        it("should forward service errors to handleError", async () => {
            const err = new Error("OAuth config missing");
            mockService.getAuthUrl.mockRejectedValue(err);

            await controller.getAuthUrl(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "googleCalendar.getAuthUrl");
        });
    });

    describe("getStatus", () => {
        it("should return the integration connection status for the authenticated user", async () => {
            mockService.getStatus.mockResolvedValue(true);

            await controller.getStatus(req, res);

            expect(mockService.getStatus).toHaveBeenCalledWith("mentor_abc_123");
            expect(ok).toHaveBeenCalledWith(res, { connected: true });
        });

        it("should return false when the user has no active Google Calendar integration", async () => {
            mockService.getStatus.mockResolvedValue(false);

            await controller.getStatus(req, res);

            expect(ok).toHaveBeenCalledWith(res, { connected: false });
        });

        it("should forward service errors to handleError", async () => {
            const err = new Error("Token lookup failed");
            mockService.getStatus.mockRejectedValue(err);

            await controller.getStatus(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "googleCalendar.handleCallback");
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

        it("should send GOOGLE_CALENDAR_ERROR postMessage when the service throws during token exchange", async () => {
            req.query = { code: "bad_code", state: "state_b64" };
            const err = new Error("Token exchange failed");
            mockService.handleCallback.mockRejectedValue(err);

            await controller.handleCallback(req, res);

            expect(mockLogger.error).toHaveBeenCalledWith(
                "Google Calendar callback error",
                expect.objectContaining({ error: "Token exchange failed" })
            );
            expect(res.send).toHaveBeenCalledWith(expect.stringContaining("GOOGLE_CALENDAR_ERROR"));
        });
    });

    describe("disconnect", () => {
        it("should call service disconnect with user id and return 204 no content", async () => {
            mockService.disconnect.mockResolvedValue();

            await controller.disconnect(req, res);

            expect(mockService.disconnect).toHaveBeenCalledWith("mentor_abc_123");
            expect(noContent).toHaveBeenCalledWith(res);
        });

        it("should forward service errors to handleError", async () => {
            const err = new Error("Token revocation failed");
            mockService.disconnect.mockRejectedValue(err);

            await controller.disconnect(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "googleCalendar.getBusySlots");
        });
    });

    describe("getBusySlots", () => {
        it("should pass date range query params to service and return busy slot array", async () => {
            req.query = { startDate: "2026-07-01", endDate: "2026-07-07" };
            const busySlots = [{ start: "2026-07-02T10:00:00Z", end: "2026-07-02T11:00:00Z" }];
            mockService.getBusySlots.mockResolvedValue(busySlots);

            await controller.getBusySlots(req, res);

            expect(mockService.getBusySlots).toHaveBeenCalledWith("mentor_abc_123", "2026-07-01", "2026-07-07");
            expect(ok).toHaveBeenCalledWith(res, { busy: busySlots });
        });

        it("should forward service errors to handleError", async () => {
            req.query = { startDate: "2026-07-01", endDate: "2026-07-07" };
            const err = new Error("Google API rate limit");
            mockService.getBusySlots.mockRejectedValue(err);

            await controller.getBusySlots(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "googleCalendar.getEvents");
        });
    });

    describe("getEvents", () => {
        it("should pass date range query params to service and return events array", async () => {
            req.query = { startDate: "2026-07-01", endDate: "2026-07-07" };
            const events = [{ id: "evt_1", summary: "Mentorship session" }];
            mockService.getEvents.mockResolvedValue(events);

            await controller.getEvents(req, res);

            expect(mockService.getEvents).toHaveBeenCalledWith("mentor_abc_123", "2026-07-01", "2026-07-07");
            expect(ok).toHaveBeenCalledWith(res, { events });
        });

        it("should forward service errors to handleError", async () => {
            req.query = { startDate: "2026-07-01", endDate: "2026-07-07" };
            const err = new Error("Calendar API unreachable");
            mockService.getEvents.mockRejectedValue(err);

            await controller.getEvents(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "googleCalendar.disconnect");
        });
    });
});