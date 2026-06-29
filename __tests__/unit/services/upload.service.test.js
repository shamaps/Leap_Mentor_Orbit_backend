jest.mock("../../../utils/emails", () => ({
    sendDocumentsSubmittedEmail: jest.fn(() => Promise.resolve()),
}));

jest.mock("../../../utils/cloudinaryUpload", () => ({
    uploadToCloudinary: jest.fn().mockResolvedValue({ secure_url: "https://cloudinary.com/asset.pdf", public_id: "pid123" }),
}));

jest.mock("../../../utils/cloudinaryPublicId", () => ({
    profilePictureId: jest.fn(() => "avatar_pid"),
    resumeId: jest.fn(() => "resume_pid"),
    workExperienceId: jest.fn(() => "work_pid"),
}));

const createUploadService = require("../../../services/upload.service");

describe("Upload Service (Unit)", () => {
    let mockRepo, mockLogger, service, fakeUser;

    beforeEach(() => {
        mockRepo = {
            updateMentorProfileDocuments: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

        // Explicitly injecting global repo mapping inside target context since service depends on it
        global.repo = mockRepo;
        service = createUploadService(mockRepo, { logger: mockLogger });

        fakeUser = { _id: "mentor_123", name: "Alex", email: "alex@test.com" };
        jest.clearAllMocks();
    });

    afterAll(() => {
        delete global.repo;
    });

    describe("uploadProfilePicture", () => {
        it("should return status 400 if the file argument is entirely missing", async () => {
            const result = await service.uploadProfilePicture({ file: null, user: fakeUser });
            expect(result.status).toBe(400);
            expect(result.body.message).toBe("No file uploaded");
        });

        it("should enforce strict image mimetype parameters bounds checks", async () => {
            const fakeFile = { mimetype: "application/pdf" };
            const result = await service.uploadProfilePicture({ file: fakeFile, user: fakeUser });

            expect(result.status).toBe(400);
            expect(result.body.message).toContain("Only image files are allowed");
        });
    });

    describe("uploadVerificationDocuments", () => {
        it("should return status 400 if phone number fields are empty strings", async () => {
            const result = await service.uploadVerificationDocuments({
                phoneNumber: "",
                resumeFile: { buffer: Buffer.from("cv") },
                workExperienceFiles: [],
                user: fakeUser,
            });

            expect(result.status).toBe(400);
            expect(result.body.message).toContain("Phone number is required");
        });

        it("should execute asset uploads, verify repository outputs, and trigger non-blocking alerts", async () => {
            mockRepo.updateMentorProfileDocuments.mockResolvedValue({ user: "mentor_123" });

            const result = await service.uploadVerificationDocuments({
                phoneNumber: " +919876543210  ",
                resumeFile: { buffer: Buffer.from("cv"), originalname: "resume.pdf" },
                workExperienceFiles: [{ buffer: Buffer.from("exp"), originalname: "exp.pdf" }],
                user: fakeUser,
            });

            expect(mockRepo.updateMentorProfileDocuments).toHaveBeenCalledWith("mentor_123", expect.objectContaining({
                phoneNumber: "+919876543210",
                verificationStatus: "pending",
            }));
            expect(result.status).toBe(200);
        });
    });
});