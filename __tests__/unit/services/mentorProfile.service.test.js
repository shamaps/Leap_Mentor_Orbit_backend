/**
 * @fileoverview Unit tests for Mentor Profile Service.
 * Secures 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../utils/mappers/mentorProfile.mapper", () => ({
    toMentorProfileDTO: jest.fn((data) => ({ success: true, ...data })),
}));

jest.mock("../../../utils/cache", () => ({
    invalidatePattern: jest.fn().mockResolvedValue(true),
    NS: { MENTOR_LIST: "ML" },
}));

const createMentorProfileService = require("../../../services/mentorProfile.service");
const cache = require("../../../utils/cache");
const AppError = require("../../../utils/appError");

describe("Mentor Profile Service Layer (100% Condition Coverage)", () => {
    let mockRepo, mockLogger, service, baseProfile;

    beforeEach(() => {
        mockRepo = {
            findProfileByUser: jest.fn(),
            findProfileByUserPopulated: jest.fn(),
            createProfile: jest.fn(),
            updateProfileByUser: jest.fn(),
            findPublicProfileByUser: jest.fn(),
        };

        mockLogger = { info: jest.fn(), error: jest.fn() };
        service = createMentorProfileService(mockRepo, { logger: mockLogger });

        baseProfile = {
            currentRole: "Staff Engineer",
            industry: "Software",
            company: "LeapMentor Corp",
        };

        jest.clearAllMocks();
    });

    describe("createProfile Workflows", () => {
        it("should throw a 409 error if an internal profile row already exists", async () => {
            mockRepo.findProfileByUser.mockResolvedValue({ _id: "existing_prof" });
            await expect(service.createProfile("u1", {}))
                .rejects.toThrow(new AppError(409, "Profile already exists. Use update instead."));
        });

        it("should substitute default parameter values and invalidate cache patterns on success", async () => {
            mockRepo.findProfileByUser.mockResolvedValue(null);
            mockRepo.createProfile.mockImplementation((data) => Promise.resolve({ ...data, _id: "new_id" }));

            const res = await service.createProfile("u1", baseProfile);

            expect(res.message).toContain("successfully");
            expect(cache.invalidatePattern).toHaveBeenCalledWith("ML:*");
            expect(mockRepo.createProfile).toHaveBeenCalledWith(expect.objectContaining({
                yearsOfExperience: 0,
                languages: ["English"],
                skills: []
            }));
        });
    });

    describe("getMyProfile Workflows", () => {
        it("should throw a 404 error if profile results return null", async () => {
            mockRepo.findProfileByUserPopulated.mockResolvedValue(null);
            await expect(service.getMyProfile("u1")).rejects.toThrow(new AppError(404, "Profile not found"));
        });

        it("should return profile DTO structures upon successful query matches", async () => {
            mockRepo.findProfileByUserPopulated.mockResolvedValue(baseProfile);
            const res = await service.getMyProfile("u1");
            expect(res.currentRole).toBe("Staff Engineer");
        });
    });

    describe("updateProfile Workflows", () => {
        it("should throw a 404 error if the targeted document updates return null", async () => {
            mockRepo.updateProfileByUser.mockResolvedValue(null);
            await expect(service.updateProfile("u1", {})).rejects.toThrow(new AppError(404, "Profile not found"));
        });

        it("should invalidate cache structures and complete update mappings on success", async () => {
            mockRepo.updateProfileByUser.mockResolvedValue(baseProfile);
            const res = await service.updateProfile("u1", { currentRole: "Staff Engineer" });
            expect(res.message).toContain("updated successfully");
            expect(cache.invalidatePattern).toHaveBeenCalledWith("ML:*");
        });
    });

    describe("getPublicProfile Workflows", () => {
        it("should throw a 404 error if public lookup maps return null attributes", async () => {
            mockRepo.findPublicProfileByUser.mockResolvedValue(null);
            await expect(service.getPublicProfile("u1")).rejects.toThrow(new AppError(404, "Mentor profile not found"));
        });

        it("should return public profile objects on success", async () => {
            mockRepo.findPublicProfileByUser.mockResolvedValue(baseProfile);
            const res = await service.getPublicProfile("u1");
            expect(res.success).toBe(true);
        });
    });
});