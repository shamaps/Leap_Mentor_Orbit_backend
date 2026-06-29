jest.mock("../../../utils/mappers/mentorProfile.mapper", () => ({
    toMentorProfileDTO: jest.fn((profile) => profile),
}));

jest.mock("../../../utils/cache", () => ({
    invalidatePattern: jest.fn().mockResolvedValue(),
    NS: { MENTOR_LIST: "mentor_list" },
}));

const createMentorProfileService = require("../../../services/mentorProfile.service");
const cache = require("../../../utils/cache");

describe("Mentor Profile Service (Unit)", () => {
    let mockRepo, mockLogger, service;

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
        jest.clearAllMocks();
    });

    describe("createProfile", () => {
        it("should throw AppError 409 if a profile records presence check catches duplicate entries", async () => {
            mockRepo.findProfileByUser.mockResolvedValue({ _id: "preexisting_id" });

            await expect(service.createProfile("mentor_abc", { currentRole: "Lead Architect" }))
                .rejects.toMatchObject({ status: 409, message: "Profile already exists. Use update instead." });
        });

        it("should apply platform defaults and drop matching public listing cache indices upon clean registrations", async () => {
            mockRepo.findProfileByUser.mockResolvedValue(null);
            mockRepo.createProfile.mockResolvedValue({ user: "mentor_abc", currentRole: "Consultant" });

            const result = await service.createProfile("mentor_abc", { currentRole: "Consultant" });

            expect(mockRepo.createProfile).toHaveBeenCalledWith(expect.objectContaining({
                user: "mentor_abc",
                yearsOfExperience: 0,
                hourlyRate: 0,
                languages: ["English"],
            }));
            expect(cache.invalidatePattern).toHaveBeenCalledWith("mentor_list:*");
            expect(result.profile).toHaveProperty("currentRole", "Consultant");
        });
    });

    describe("updateProfile", () => {
        it("should clear cache templates and return updated profiles objects on success", async () => {
            mockRepo.updateProfileByUser.mockResolvedValue({ _id: "p1", bio: "New Info" });

            const result = await service.updateProfile("mentor_abc", { bio: "New Info" });

            expect(mockRepo.updateProfileByUser).toHaveBeenCalledWith("mentor_abc", { bio: "New Info" });
            expect(cache.invalidatePattern).toHaveBeenCalledWith("mentor_list:*");
            expect(result.message).toBe("Profile updated successfully");
        });
    });
});