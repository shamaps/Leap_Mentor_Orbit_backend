/**
 * @fileoverview Unit tests for Mentor Profile Controller.
 * Achieves 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(500).json({ error: err.message, context })),
}));

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json(data)),
    created: jest.fn((res, data) => res.status(201).json(data)),
}));

const createMentorProfileController = require("../../../controllers/mentorProfile.controller");
const { handleError } = require("../../../utils/appError");
const { ok, created } = require("../../../utils/response");

describe("Mentor Profile Controller (100% Comprehensive Coverage Blueprint)", () => {
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

        req = {
            params: { id: "mentor_public_999" },
            body: { bio: "Senior Staff Architect", skills: ["System Design", "Cloud Architecture"] },
            user: { _id: "user_mentor_555" },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        jest.clearAllMocks();
    });

    describe("createProfile Endpoint", () => {
        it("should return a 201 created response upon successful creation", async () => {
            const mockData = { id: "p_mentor_1", bio: "Senior Staff Architect" };
            mockService.createProfile.mockResolvedValue(mockData);

            await controller.createProfile(req, res);

            expect(mockService.createProfile).toHaveBeenCalledWith("user_mentor_555", req.body);
            expect(created).toHaveBeenCalledWith(res, mockData);
        });

        it("should route profile creation errors through the handleError helper", async () => {
            const err = new Error("Database validation error constraint");
            mockService.createProfile.mockRejectedValue(err);

            await controller.createProfile(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "mentorProfile.createProfile");
        });
    });

    describe("getMyProfile Endpoint", () => {
        it("should return internal session profile components successfully", async () => {
            const mockData = { user: "user_mentor_555", internalRating: 5.0 };
            mockService.getMyProfile.mockResolvedValue(mockData);

            await controller.getMyProfile(req, res);

            expect(mockService.getMyProfile).toHaveBeenCalledWith("user_mentor_555");
            expect(ok).toHaveBeenCalledWith(res, mockData);
        });

        it("should catch profile fetching exceptions and route them to handleError", async () => {
            const err = new Error("Profile fetching exception error");
            mockService.getMyProfile.mockRejectedValue(err);

            await controller.getMyProfile(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "mentorProfile.getMyProfile");
        });
    });

    describe("updateProfile Endpoint", () => {
        it("should apply delta modifications over records successfully", async () => {
            const mockUpdatedData = { updated: true, payload: {} };
            mockService.updateProfile.mockResolvedValue(mockUpdatedData);

            await controller.updateProfile(req, res);

            expect(mockService.updateProfile).toHaveBeenCalledWith("user_mentor_555", req.body);
            expect(ok).toHaveBeenCalledWith(res, mockUpdatedData);
        });

        it("should pass update handling exceptions directly to handleError", async () => {
            const err = new Error("Update concurrency collision fail");
            mockService.updateProfile.mockRejectedValue(err);

            await controller.updateProfile(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "mentorProfile.updateProfile");
        });
    });

    describe("getPublicProfile Endpoint", () => {
        it("should extract sanitized public fields successfully", async () => {
            const mockPublicFields = { mentorName: "Jane Smith", rating: 4.9 };
            mockService.getPublicProfile.mockResolvedValue(mockPublicFields);

            await controller.getPublicProfile(req, res);

            expect(mockService.getPublicProfile).toHaveBeenCalledWith("mentor_public_999");
            expect(ok).toHaveBeenCalledWith(res, mockPublicFields);
        });

        it("should send public query route exceptions through to handleError", async () => {
            const err = new Error("Profile index hidden or private");
            mockService.getPublicProfile.mockRejectedValue(err);

            await controller.getPublicProfile(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "mentorProfile.getPublicProfile");
        });
    });
});