const createMentorReferService = require("../../../services/mentorRefer.service");

describe("Mentor Referral Service (Unit)", () => {
    let mockRepo, mockLogger, service;

    beforeEach(() => {
        mockRepo = {
            findRequestWithMentor: jest.fn(),
            findMyProfileSkills: jest.fn(),
            findSimilarMentors: jest.fn(),
        };
        mockLogger = { info: jest.fn(), error: jest.fn() };
        service = createMentorReferService(mockRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    it("should throw AppError 404 if connection request documents resolve empty", async () => {
        mockRepo.findRequestWithMentor.mockResolvedValue(null);

        await expect(service.getSimilarMentors("bad_req", "u1"))
            .rejects.toMatchObject({ status: 404, message: "Request not found" });
    });

    it("should throw AppError 403 if user credentials mismatch the target request recipient", async () => {
        mockRepo.findRequestWithMentor.mockResolvedValue({ mentor: { _id: "mentor_owner" } });

        await expect(service.getSimilarMentors("req_1", "malicious_mentor"))
            .rejects.toMatchObject({ status: 403, message: "Not authorized" });
    });

    it("should short-circuit with empty array elements if the active mentor has zero logged skills", async () => {
        mockRepo.findRequestWithMentor.mockResolvedValue({ mentor: { _id: "m1" } });
        mockRepo.findMyProfileSkills.mockResolvedValue({ skills: [] });

        const result = await service.getSimilarMentors("req_1", "m1");
        expect(result).toEqual({ mentors: [], mySkills: [] });
        expect(mockRepo.findSimilarMentors).not.toHaveBeenCalled();
    });

    it("should compute intersection counts and return candidates ranked descending by competency overlaps", async () => {
        mockRepo.findRequestWithMentor.mockResolvedValue({ mentor: { _id: "m1" } });
        mockRepo.findMyProfileSkills.mockResolvedValue({ skills: ["Node.js", "Docker", "AWS"] });

        const unrankedMentors = [
            { user: "m2", skills: ["Node.js"] }, // 1 match
            { user: "m3", skills: ["Docker", "aws", "React"] }, // 2 matches (case-insensitive)
        ];
        mockRepo.findSimilarMentors.mockResolvedValue(unrankedMentors);

        const result = await service.getSimilarMentors("req_1", "m1");

        expect(result.mySkills).toEqual(["Node.js", "Docker", "AWS"]);
        expect(result.mentors[0].user).toBe("m3"); // 2 matches ranks first
        expect(result.mentors[0].matchCount).toBe(2);
        expect(result.mentors[1].user).toBe("m2"); // 1 match ranks second
        expect(result.mentors[1].matchCount).toBe(1);
    });
});