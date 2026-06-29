jest.mock("../../../middleware/upload.middleware", () => ({
    getFileType: jest.fn(() => "image"),
}));

jest.mock("../../../utils/sessionAccess", () => ({
    validateSessionAccess: jest.fn(),
}));

jest.mock("../../../utils/cloudinaryUpload", () => ({
    uploadToCloudinary: jest.fn().mockResolvedValue({
        secure_url: "https://cloudinary.com/target.png",
        public_id: "leapmentor/notes/abc",
        eager: [{ secure_url: "https://cloudinary.com/thumb.png" }],
    }),
}));

jest.mock("../../../utils/cloudinarySign", () => ({
    signCloudinaryUrl: jest.fn((id) => `https://signed.cloudinary.com/${id}`),
}));

jest.mock("../../../utils/cloudinaryPublicId", () => ({
    noteId: jest.fn(() => "mocked_public_id"),
}));

jest.mock("../../../config/cloudinary", () => ({
    cloudinary: {
        uploader: {
            destroy: jest.fn().mockResolvedValue({ result: "ok" }),
        },
    },
}));

const createNoteService = require("../../../services/note.service");
const { validateSessionAccess } = require("../../../utils/sessionAccess");
// FIXED: Repositioned relative path context to point properly to the configuration directory
const { cloudinary } = require("../../../config/cloudinary");

describe("Note Service (Unit)", () => {
    let mockRepo, mockLogger, service;

    beforeEach(() => {
        mockRepo = {
            findSessionParticipants: jest.fn(),
            createNote: jest.fn(),
            findNoteByIdPopulated: jest.fn(),
            findSharedNotes: jest.fn(),
            findPrivateNotes: jest.fn(),
            findNoteById: jest.fn(),
            deleteNoteById: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createNoteService(mockRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    describe("uploadNote", () => {
        it("should throw a 400 error if the connectRequestId parameter is missing", async () => {
            await expect(service.uploadNote("u1", {}, {}))
                .rejects.toMatchObject({ status: 400, message: "connectRequestId is required" });
        });

        it("should throw an authorization error if the session verification hook declares access invalid", async () => {
            validateSessionAccess.mockResolvedValue({ valid: false, status: 403, reason: "Not a participant" });

            await expect(service.uploadNote("u1", { connectRequestId: "s1" }, { originalname: "test.png" }))
                .rejects.toMatchObject({ status: 403, message: "Not a participant" });
        });

        it("should commit records onto persistent datastores when files clear validation checkpoints", async () => {
            validateSessionAccess.mockResolvedValue({ valid: true, uploaderRole: "mentee", sessionStatus: "ongoing" });
            mockRepo.createNote.mockResolvedValue({ _id: "note_777" });
            mockRepo.findNoteByIdPopulated.mockResolvedValue({ title: "homework.png" });

            const fakeFile = { originalname: "homework.png", mimetype: "image/png", buffer: Buffer.from(""), size: 500 };
            const result = await service.uploadNote("user_mentee", { connectRequestId: "session_1" }, fakeFile);

            expect(mockRepo.createNote).toHaveBeenCalledWith(expect.objectContaining({
                uploadedBy: "user_mentee",
                fileName: "homework.png",
            }));
            expect(result.note).toHaveProperty("title", "homework.png");
        });
    });

    describe("deleteNote", () => {
        it("should block deletion loops and return status 403 if users attempt to purge notes uploaded by peers", async () => {
            mockRepo.findNoteById.mockResolvedValue({ uploadedBy: "rightful_owner_id" });

            await expect(service.deleteNote("note_1", "malicious_thief_id"))
                .rejects.toMatchObject({ status: 403, message: "You can only delete your own notes" });
        });

        it("should erase content blocks from Cloudinary before wiping related records out of database tiers", async () => {
            mockRepo.findNoteById.mockResolvedValue({ uploadedBy: "owner_1", fileType: "image", publicId: "pid_123" });

            await service.deleteNote("note_1", "owner_1");

            expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("pid_123", { resource_type: "image" });
            expect(mockRepo.deleteNoteById).toHaveBeenCalledWith("note_1");
        });
    });
});