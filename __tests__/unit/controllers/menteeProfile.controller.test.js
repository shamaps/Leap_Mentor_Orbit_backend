/**
 * @fileoverview Unit tests for Mentee Profile Controller.
 * Achieves 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(500).json({ error: err.message, context })),
}));

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json(data)),
    created: jest.fn((res, data) => res.status(201).json(data)),
}));

const createMenteeProfileController = require("../../../controllers/menteeProfile.controller");
const { handleError } = require("../../../utils/appError");
const { ok, created } = require("../../../utils/response");

describe("Mentee Profile Controller (100% Comprehensive Coverage Blueprint)", () => {
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

        req = {
            params: { id: "mentee_public_001" },
            body: { bio: "Aspiring Software Engineer", goals: ["Learn Node.js"] },
            user: { _id: "user_mentee_888" },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        jest.clearAllMocks();
    });

    describe("createProfile Endpoint", () => {
        it("should return a 201 created data structure response upon successful profile creation", async () => {
            const mockData = { id: "p_1", bio: "Aspiring Software Engineer" };
            mockService.createProfile.mockResolvedValue(mockData);

            await controller.createProfile(req, res);

            expect(mockService.createProfile).toHaveBeenCalledWith("user_mentee_888", req.body);
            expect(created).toHaveBeenCalledWith(res, mockData);
        });

        it("should route profile creation failure down through the handleError helper", async () => {
            const err = new Error("Database validation failed constraint");
            mockService.createProfile.mockRejectedValue(err);

            await controller.createProfile(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "menteeProfile.createProfile");
        });
    });

    describe("getMyProfile Endpoint", () => {
        it("should return internal session profile indicators successfully", async () => {
            const mockData = { user: "user_mentee_888", privateNotes: [] };
            mockService.getMyProfile.mockResolvedValue(mockData);

            await controller.getMyProfile(req, res);

            expect(mockService.getMyProfile).toHaveBeenCalledWith("user_mentee_888");
            expect(ok).toHaveBeenCalledWith(res, mockData);
        });

        it("should catch profile loading errors and pass down to handleError", async () => {
            const err = new Error("Session expired profile lock");
            mockService.getMyProfile.mockRejectedValue(err);

            await controller.getMyProfile(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "menteeProfile.getMyProfile");
        });
    });

    describe("updateProfile Endpoint", () => {
        it("should apply delta updates successfully over profile record fields", async () => {
            const mockUpdatedData = { updated: true };
            mockService.updateProfile.mockResolvedValue(mockUpdatedData);

            await controller.updateProfile(req, res);

            expect(mockService.updateProfile).toHaveBeenCalledWith("user_mentee_888", req.body);
            expect(ok).toHaveBeenCalledWith(res, mockUpdatedData);
        });

        it("should pass update processing errors straight into handleError", async () => {
            const err = new Error("Update transaction lock conflict");
            mockService.updateProfile.mockRejectedValue(err);

            await controller.updateProfile(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "menteeProfile.updateProfile");
        });
    });

    describe("getPublicProfile Endpoint", () => {
        it("should extract sanitized public profile metadata fields successfully", async () => {
            const mockPublicData = { name: "John Doe", publicBio: "Hello" };
            mockService.getPublicProfile.mockResolvedValue(mockPublicData);

            await controller.getPublicProfile(req, res);

            expect(mockService.getPublicProfile).toHaveBeenCalledWith("mentee_public_001");
            expect(ok).toHaveBeenCalledWith(res, mockPublicData);
        });

        it("should route public query exceptions directly through handleError", async () => {
            const err = new Error("Profile not visible or soft deleted");
            mockService.getPublicProfile.mockRejectedValue(err);

            await controller.getPublicProfile(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "menteeProfile.getPublicProfile");
        });
    });
});