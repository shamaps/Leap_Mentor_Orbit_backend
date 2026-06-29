jest.mock("../../../utils/mappers/menteeProfile.mapper", () => ({
    toMenteeProfileDTO: jest.fn((profile) => profile),
}));

const createMenteeProfileService = require("../../../services/menteeProfile.service");

describe("Mentee Profile Service (Unit)", () => {
    let mockRepo, mockLogger, service;

    beforeEach(() => {
        mockRepo = {
            findProfileByUser: jest.fn(),
            findProfileByUserPopulated: jest.fn(),
            createProfile: jest.fn(),
            updateProfileByUser: jest.fn(),
            findPublicProfileByUser: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createMenteeProfileService(mockRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    describe("createProfile", () => {
        it("should throw AppError 409 if a profile entity already exists for the matching user identifier", async () => {
            mockRepo.findProfileByUser.mockResolvedValue({ _id: "existing_profile_id" });

            await expect(service.createProfile("mentee_123", { currentRole: "Designer" }))
                .rejects.toMatchObject({ status: 409, message: "Profile already exists" });
        });

        it("should normalize empty field parameters into standard system defaults on creation", async () => {
            mockRepo.findProfileByUser.mockResolvedValue(null);
            mockRepo.createProfile.mockResolvedValue({ user: "mentee_123", currentRole: "QA Engineer" });

            const result = await service.createProfile("mentee_123", { currentRole: "QA Engineer" });

            expect(mockRepo.createProfile).toHaveBeenCalledWith(expect.objectContaining({
                user: "mentee_123",
                currentRole: "QA Engineer",
                yearsOfExperience: 0,
                languages: ["English"],
            }));
            expect(result.profile).toHaveProperty("currentRole", "QA Engineer");
        });
    });

    describe("getMyProfile", () => {
        it("should throw AppError 404 with incomplete flags attributes if record retrieval resolves empty", async () => {
            mockRepo.findProfileByUserPopulated.mockResolvedValue(null);

            await expect(service.getMyProfile("mentee_empty"))
                .rejects.toMatchObject({ status: 404, message: "Profile not found", meta: { isProfileComplete: false } });
        });
    });
});