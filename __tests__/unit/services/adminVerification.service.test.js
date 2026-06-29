/**
 * @fileoverview Complete unit tests for Admin Verification Service.
 * Secures 100% statement, line, condition, and branch passing coverage.
 */

jest.mock("../../../utils/emails", () => ({
    sendMentorVerifiedEmail: jest.fn().mockResolvedValue({}),
}));

jest.mock("../../../utils/mappers/mentorProfile.mapper", () => ({
    toMentorProfileDTO: jest.fn((profile) => profile),
}));

jest.mock("../../../utils/cloudinarySign", () => ({
    signCloudinaryUrl: jest.fn((publicId) => `https://signed-cloudinary.com/${publicId}`),
}));

const createAdminVerificationService = require("../../../services/adminVerification.service");
const { signCloudinaryUrl } = require("../../../utils/cloudinarySign");
const { sendMentorVerifiedEmail } = require("../../../utils/emails");
const AppError = require("../../../utils/appError");

describe("Admin Verification Service (100% Gaps Filled)", () => {
    let mockRepo, mockLogger, service, mockProfileDoc;

    beforeEach(() => {
        mockRepo = {
            findMentorUserIdsByName: jest.fn(),
            findAllMentorProfiles: jest.fn(),
            countMentorProfiles: jest.fn(),
            findMentorProfileById: jest.fn(),
            findMentorProfileDocumentById: jest.fn(),
        };

        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createAdminVerificationService(mockRepo, { logger: mockLogger });

        mockProfileDoc = {
            _id: "p_123",
            verificationStatus: "unverified",
            user: { name: "John Doe", email: "john@test.com" },
            resumeDocument: { publicId: "res_999", url: "" },
            workExperienceDocuments: [{ publicId: "work_888", url: "" }],
            save: jest.fn().mockResolvedValue(true),
        };

        global.AppError = AppError;
        jest.clearAllMocks();
    });

    describe("getAllMentorVerifications", () => {
        it("should cleanly assign default parameters and return un-searched pagination layout", async () => {
            mockRepo.findAllMentorProfiles.mockResolvedValue([]);
            mockRepo.countMentorProfiles.mockResolvedValue(0);

            const res = await service.getAllMentorVerifications(); // tests empty params layout = {}

            expect(res.pagination).toEqual({ page: 1, limit: 20, total: 0, pages: 0 });
            expect(mockRepo.findMentorUserIdsByName).not.toHaveBeenCalled();
        });

        it("should clamp unparseable page/limit elements and resolve user criteria arrays if query text is provided", async () => {
            mockRepo.findMentorUserIdsByName.mockResolvedValue(["u_1", "u_2"]);
            mockRepo.findAllMentorProfiles.mockResolvedValue([{ _id: "p_1" }]);
            mockRepo.countMentorProfiles.mockResolvedValue(1);

            const res = await service.getAllMentorVerifications({
                page: -5, // triggers Math.max(1, ...) lower bound clamp
                limit: 150, // triggers Math.min(50, ...) upper bound clamp
                search: "   Alex   " // tests .trim() functionality
            });

            expect(mockRepo.findMentorUserIdsByName).toHaveBeenCalledWith("Alex");
            expect(mockRepo.findAllMentorProfiles).toHaveBeenCalledWith({ user: { $in: ["u_1", "u_2"] } }, 0, 50);
            expect(res.pagination.limit).toBe(50);
        });

        it("should fall back cleanly to 1 and 20 if page and limit cannot be parsed to integers", async () => {
            // COVERAGE: This explicit test forces NaN parsing results to hit the hidden fallback loops: || 1 and || 20
            mockRepo.findAllMentorProfiles.mockResolvedValue([]);
            mockRepo.countMentorProfiles.mockResolvedValue(0);

            const res = await service.getAllMentorVerifications({
                page: "completely_invalid_page_string",
                limit: "completely_invalid_limit_string"
            });

            expect(res.pagination.page).toBe(1);
            expect(res.pagination.limit).toBe(20);
        });
    });

    describe("getMentorVerificationById", () => {
        it("should throw AppError 404 if matching profile row does not exist", async () => {
            mockRepo.findMentorProfileById.mockResolvedValue(null);
            await expect(service.getMentorVerificationById("missing_id"))
                .rejects.toMatchObject({ status: 404, message: "Mentor profile not found" });
        });

        it("should map Cloudinary viewing URLs and strip inner users references payload", async () => {
            mockRepo.findMentorProfileById.mockResolvedValue(mockProfileDoc);

            const res = await service.getMentorVerificationById("p_123");

            expect(signCloudinaryUrl).toHaveBeenCalledWith("res_999", "raw");
            expect(signCloudinaryUrl).toHaveBeenCalledWith("work_888", "raw");
            expect(res.user).toBeDefined();
        });

        it("should bypass Cloudinary url mutations safely if inner document sub-keys are missing", async () => {
            mockProfileDoc.resumeDocument = null;
            mockProfileDoc.workExperienceDocuments = [];
            mockRepo.findMentorProfileById.mockResolvedValue(mockProfileDoc);

            const res = await service.getMentorVerificationById("p_123");
            expect(res.mentorProfile).toBeDefined();
        });
    });

    describe("verifyMentor", () => {
        it("should throw AppError 404 if verification target row cannot be located", async () => {
            mockRepo.findMentorProfileDocumentById.mockResolvedValue(null);
            await expect(service.verifyMentor("missing_id")).rejects.toMatchObject({ status: 404 });
        });

        it("should throw AppError 400 if profile verification status equals verified already", async () => {
            mockProfileDoc.verificationStatus = "verified";
            mockRepo.findMentorProfileDocumentById.mockResolvedValue(mockProfileDoc);

            await expect(service.verifyMentor("p_123"))
                .rejects.toMatchObject({ status: 400, message: "Mentor is already verified" });
        });

        it("should transition verification parameters safely and handle non-blocking dispatch mailer exceptions", async () => {
            mockRepo.findMentorProfileDocumentById.mockResolvedValue(mockProfileDoc);
            sendMentorVerifiedEmail.mockRejectedValueOnce(new Error("SMTP Server Timeout"));

            const res = await service.verifyMentor("p_123");

            expect(mockProfileDoc.verificationStatus).toBe("verified");
            expect(mockProfileDoc.save).toHaveBeenCalled();

            await new Promise((resolve) => setImmediate(resolve));
            expect(mockLogger.warn).toHaveBeenCalledWith("sendMentorVerifiedEmail failed", { error: "SMTP Server Timeout" });
            expect(res.verificationStatus).toBe("verified");
        });

        it("should fallback cleanly if user name parameters drop unassigned during confirmation print mapping", async () => {
            mockProfileDoc.user = { name: "", email: "test@test.com" };
            mockRepo.findMentorProfileDocumentById.mockResolvedValue(mockProfileDoc);

            const res = await service.verifyMentor("p_123");
            expect(res.message).toContain("Mentor has been verified successfully");
        });
    });

    describe("revokeMentorVerification", () => {
        it("should throw AppError 404 if profile context row returns null", async () => {
            mockRepo.findMentorProfileDocumentById.mockResolvedValue(null);
            await expect(service.revokeMentorVerification("missing_id")).rejects.toMatchObject({ status: 404 });
        });

        it("should throw AppError 400 if target row status matches unverified already", async () => {
            mockProfileDoc.verificationStatus = "unverified";
            mockRepo.findMentorProfileDocumentById.mockResolvedValue(mockProfileDoc);

            await expect(service.revokeMentorVerification("p_123"))
                .rejects.toMatchObject({ status: 400, message: "Mentor is already unverified" });
        });

        it("should downgrade parameter visibility fields cleanly back onto tracking base baselines", async () => {
            mockProfileDoc.verificationStatus = "verified";
            mockRepo.findMentorProfileDocumentById.mockResolvedValue(mockProfileDoc);

            const res = await service.revokeMentorVerification("p_123");

            expect(mockProfileDoc.verificationStatus).toBe("unverified");
            expect(mockProfileDoc.save).toHaveBeenCalled();
            expect(res.verificationStatus).toBe("unverified");
        });

        it("should fallback cleanly to printing 'mentor' if user name fields are absent on revocation logs mapping", async () => {
            mockProfileDoc.verificationStatus = "verified";
            mockProfileDoc.user = { name: "", email: "test@test.com" };
            mockRepo.findMentorProfileDocumentById.mockResolvedValue(mockProfileDoc);

            const res = await service.revokeMentorVerification("p_123");
            expect(res.message).toContain("Verification revoked for mentor");
        });
    });
});