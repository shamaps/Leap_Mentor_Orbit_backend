jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
    created: jest.fn((res, data) => res.status(201).json({ success: true, data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createMentorProfileController = require("../../../controllers/mentorProfile.controller");
const { ok, created } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Mentor Profile Controller (Unit)", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = {
            createProfile: jest.fn(),
            getMyProfile: jest.fn(),
            updateProfile: jest.fn(),
            getPublicProfile: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createMentorProfileController(mockService, { logger: mockLogger });

        req = { user: { _id: "mentor_user_999" }, body: {}, params: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("createProfile", () => {
        it("should forward session variables, include the request body, and return status 201 on completion", async () => {
            req.body = { currentRole: "Staff Engineer", hourlyRate: 50 };
            const serviceResult = { message: "Created", profile: { currentRole: "Staff Engineer" } };
            mockService.createProfile.mockResolvedValue(serviceResult);

            await controller.createProfile(req, res);

            expect(mockService.createProfile).toHaveBeenCalledWith("mentor_user_999", req.body);
            expect(created).toHaveBeenCalledWith(res, serviceResult);
        });

        it("should safely pass validation and service processing errors into app fallback handlers", async () => {
            const error = new Error("Mongoose constraint failure");
            mockService.createProfile.mockRejectedValue(error);

            await controller.createProfile(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "mentorProfile.createProfile");
        });
    });

    describe("updateProfile", () => {
        it("should process delta payload properties and yield a successful status 200 payload mapping", async () => {
            req.body = { bio: "Updated professional backstory" };
            mockService.updateProfile.mockResolvedValue({ message: "Updated" });

            await controller.updateProfile(req, res);

            expect(mockService.updateProfile).toHaveBeenCalledWith("mentor_user_999", req.body);
            expect(ok).toHaveBeenCalledWith(res, { message: "Updated" });
        });
    });
});