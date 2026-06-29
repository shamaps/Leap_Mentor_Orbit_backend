/**
 * @fileoverview Unit tests for Availability Controller.
 * Evaluates Express middleware translation layers and HTTP query normalization.
 */

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
    created: jest.fn((res, data) => res.status(201).json({ success: true, data })),
    noContent: jest.fn((res) => res.status(204).send()),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createAvailabilityController = require("../../../controllers/availability.controller");
const { ok, created, noContent } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Availability Controller (Unit)", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = {
            getMyAvailability: jest.fn(),
            createAvailability: jest.fn(),
            updateAvailability: jest.fn(),
            getMentorAvailability: jest.fn(),
            deleteAvailability: jest.fn(),
            getAvailableSlots: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createAvailabilityController(mockService, { logger: mockLogger });

        req = { user: { _id: "user_m1" }, body: {}, params: {}, query: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("getMyAvailability", () => {
        it("should successfully extract authentication user parameter context and call service", async () => {
            const mockResult = { timezone: "Asia/Kolkata", slots: [] };
            mockService.getMyAvailability.mockResolvedValue(mockResult);

            await controller.getMyAvailability(req, res);

            expect(mockService.getMyAvailability).toHaveBeenCalledWith("user_m1");
            expect(ok).toHaveBeenCalledWith(res, mockResult);
        });

        it("should redirect service thrown exceptions into the runtime error handler", async () => {
            const testError = new Error("DB read error");
            mockService.getMyAvailability.mockRejectedValue(testError);

            await controller.getMyAvailability(req, res);

            expect(handleError).toHaveBeenCalledWith(res, testError, "availability.getMyAvailability");
        });
    });

    describe("createAvailability", () => {
        it("should issue a 201 created macro structure envelope containing resource metadata", async () => {
            req.body = { timezone: "UTC", sessionDurations: [30] };
            const createdPayload = { _id: "av_1", timezone: "UTC" };
            mockService.createAvailability.mockResolvedValue(createdPayload);

            await controller.createAvailability(req, res);

            expect(mockService.createAvailability).toHaveBeenCalledWith("user_m1", req.body);
            expect(created).toHaveBeenCalledWith(res, {
                message: "Availability created successfully",
                availability: createdPayload,
            });
        });
    });

    describe("getAvailableSlots", () => {
        it("should fallback to a default booking duration window size if query option items are unassigned", async () => {
            req.params.mentorId = "mentor_target";
            req.query = {}; // missing explicit ?duration= params
            mockService.getAvailableSlots.mockResolvedValue([]);

            await controller.getAvailableSlots(req, res);

            expect(mockService.getAvailableSlots).toHaveBeenCalledWith("mentor_target", 60, "user_m1");
            expect(ok).toHaveBeenCalled();
        });

        it("should correctly parse custom duration primitives into matching integer values", async () => {
            req.params.mentorId = "mentor_target";
            req.query = { duration: "45" };

            await controller.getAvailableSlots(req, res);

            expect(mockService.getAvailableSlots).toHaveBeenCalledWith("mentor_target", 45, "user_m1");
        });
    });

    describe("deleteAvailability", () => {
        it("should execute service teardown logic and return empty body response structures", async () => {
            mockService.deleteAvailability.mockResolvedValue();

            await controller.deleteAvailability(req, res);

            expect(mockService.deleteAvailability).toHaveBeenCalledWith("user_m1");
            expect(noContent).toHaveBeenCalledWith(res);
        });
    });
});