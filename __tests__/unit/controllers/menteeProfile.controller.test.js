jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
    created: jest.fn((res, data) => res.status(201).json({ success: true, data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createMenteeProfileController = require("../../../controllers/menteeProfile.controller");
const { ok, created } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Mentee Profile Controller (Unit)", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = {
            createProfile: jest.fn(),
            getMyProfile: jest.fn(),
            updateProfile: jest.fn(),
            getPublicProfile: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createMenteeProfileController(mockService, { logger: mockLogger });

        req = { user: { _id: "mentee_user_777" }, body: {}, params: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("createProfile", () => {
        it("should extract actor identity frames, pass payload parameters body, and respond with status 201", async () => {
            req.body = { currentRole: "Data Analyst", industry: "Healthcare" };
            const serviceResult = { message: "Created", profile: { currentRole: "Data Analyst" } };
            mockService.createProfile.mockResolvedValue(serviceResult);

            await controller.createProfile(req, res);

            expect(mockService.createProfile).toHaveBeenCalledWith("mentee_user_777", req.body);
            expect(created).toHaveBeenCalledWith(res, serviceResult);
        });

        it("should tunnel thrown service failures directly to fallback application error utilities", async () => {
            const error = new Error("Database validation failure rules");
            mockService.createProfile.mockRejectedValue(error);

            await controller.createProfile(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "menteeProfile.createProfile");
        });
    });

    describe("getPublicProfile", () => {
        it("should target primary path parameters and return public maps with a 200 envelope", async () => {
            req.params.id = "target_user_888";
            const publicFixture = { currentRole: "Software Engineer", bio: "Public bio summary" };
            mockService.getPublicProfile.mockResolvedValue(publicFixture);

            await controller.getPublicProfile(req, res);

            expect(mockService.getPublicProfile).toHaveBeenCalledWith("target_user_888");
            expect(ok).toHaveBeenCalledWith(res, publicFixture);
        });
    });
});