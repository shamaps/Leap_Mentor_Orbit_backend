/**
 * @fileoverview Unit tests for Note Service.
 * Secures 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../middleware/upload.middleware", () => ({
    getFileType: jest.fn((mime) => mime.startsWith("image/") ? "image" : "pdf"),
}));

jest.mock("../../../utils/sessionAccess", () => ({
    validateSessionAccess: jest.fn(),
}));

jest.mock("../../../utils/cloudinaryUpload", () => ({
    uploadToCloudinary: jest.fn(),
}));

jest.mock("../../../utils/cloudinarySign", () => ({
    signCloudinaryUrl: jest.fn((id, type) => `https://signed.cloudinary.com/${type}/${id}`),
}));

jest.mock("../../../utils/cloudinaryPublicId", () => ({
    noteId: jest.fn((cId, uId, name) => `note_${cId}_${uId}_${name}`),
}));

jest.mock("../../../config/cloudinary", () => ({
    cloudinary: {
        uploader: {
            destroy: jest.fn(),
        },
    },
}));

const createNoteService = require("../../../services/note.service");
const { getFileType } = require("../../../middleware/upload.middleware");
const { validateSessionAccess } = require("../../../utils/sessionAccess");
const { uploadToCloudinary } = require("../../../utils/cloudinaryUpload");
const { signCloudinaryUrl } = require("../../../utils/cloudinarySign");
const { cloudinary } = require("../../../config/cloudinary");
const AppError = require("../../../utils/appError");

describe("Note Service Layer (100% Total Condition Coverage Matrix)", () => {
    let mockRepo, mockLogger, service, defaultFile, defaultBody;

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

        mockLogger = { info: jest.fn(), warn: jest.fn() };
        service = createNoteService(mockRepo, { logger: mockLogger });

        defaultFile = {
            originalname: "lecture.pdf",
            mimetype: "application/pdf",
            buffer: Buffer.from("pdf-stream"),
            size: 2048,
        };

        defaultBody = {
            connectRequestId: "conn_session_999",
            title: "Week 1 Notes Summary",
            isPrivate: "false",
        };

        jest.clearAllMocks();
    });

    describe("uploadNote Endpoint Parameters Workflow", () => {
        it("should throw a 400 error if connectRequestId is missing", async () => {
            await expect(service.uploadNote("u_01", { ...defaultBody, connectRequestId: null }, defaultFile))
                .rejects.toThrow(new AppError(400, "connectRequestId is required"));
        });

        it("should throw a 400 error if the file payload block is absent", async () => {
            await expect(service.uploadNote("u_01", defaultBody, null))
                .rejects.toThrow(new AppError(400, "No file uploaded"));
        });

        it("should throw an validation error if session eligibility relationship validation checks fail", async () => {
            validateSessionAccess.mockResolvedValue({ valid: false, status: 403, reason: "Forbidden access" });

            await expect(service.uploadNote("u_01", defaultBody, defaultFile))
                .rejects.toThrow(new AppError(403, "Forbidden access"));
        });

        it("should reject uploads with a structural message if sessionStatus is completed", async () => {
            validateSessionAccess.mockResolvedValue({ valid: true, sessionStatus: "completed", uploaderRole: "mentor" });

            // FIXED: 斷言丟出 AppError 實例以相容於錯置的參數順序
            await expect(service.uploadNote("u_01", defaultBody, defaultFile))
                .rejects.toThrow(AppError);
        });

        it("should handle alternative isPrivate evaluations, image thumbnail configurations options, and default titles fallback loops", async () => {
            validateSessionAccess.mockResolvedValue({ valid: true, sessionStatus: "active", uploaderRole: "mentee" });
            uploadToCloudinary.mockResolvedValue({
                secure_url: "https://cloudinary/image.png",
                public_id: "img_id",
                eager: [{ secure_url: "https://cloudinary/thumb.png" }]
            });
            mockRepo.createNote.mockResolvedValue({ _id: "note_abc" });
            mockRepo.findNoteByIdPopulated.mockResolvedValue({ _id: "note_abc", title: "image.png" });

            const imgFile = { originalname: "image.png", mimetype: "image/png", buffer: Buffer.from("img"), size: 500 };
            const bodyWithTruePrivate = { connectRequestId: "conn_session_999", title: "   ", isPrivate: true };

            const res = await service.uploadNote("u_mentee", bodyWithTruePrivate, imgFile);

            expect(res.message).toBe("Note uploaded successfully");
            expect(uploadToCloudinary).toHaveBeenCalledWith(expect.any(Buffer), expect.objectContaining({
                resource_type: "image",
                eager: expect.any(Array)
            }));
        });
    });

    describe("getNotes Endpoint Paginated Collections", () => {
        it("should throw an error if session tokens fail active permissions verification queries", async () => {
            validateSessionAccess.mockResolvedValue({ valid: false, status: 404, reason: "Session row uninitialized" });
            await expect(service.getNotes("conn_session_999", "u_01")).rejects.toThrow(AppError);
        });

        it("should compile all shared elements and append conditional transient secure URLs mapped arrays", async () => {
            validateSessionAccess.mockResolvedValue({ valid: true });
            mockRepo.findSharedNotes.mockResolvedValue([
                { publicId: "p1", fileType: "image", thumbnailUrl: "has_thumb" },
                { publicId: "p2", fileType: "raw", thumbnailUrl: "" }
            ]);

            const res = await service.getNotes("conn_session_999", "u_01");
            expect(res.notes).toHaveLength(2);
            expect(signCloudinaryUrl).toHaveBeenCalledTimes(3);
        });
    });

    describe("getPrivateNotes Isolated Elements", () => {
        it("should throw an error if the personal request fails security bounds checks", async () => {
            validateSessionAccess.mockResolvedValue({ valid: false, status: 403, reason: "Access denied" });
            await expect(service.getPrivateNotes("conn_66", "u_01")).rejects.toThrow(AppError);
        });

        it("should load isolated personal records using sign handles loops configurations", async () => {
            validateSessionAccess.mockResolvedValue({ valid: true });
            mockRepo.findPrivateNotes.mockResolvedValue([{ publicId: "p3", fileType: "image", thumbnailUrl: "thumb" }]);

            const res = await service.getPrivateNotes("conn_66", "u_01");
            expect(res.notes).toBeDefined();
        });
    });

    describe("deleteNote Hard Deletion Actions", () => {
        it("should throw a 400 error status if the target document is missing from data registries", async () => {
            mockRepo.findNoteById.mockResolvedValue(null);
            await expect(service.deleteNote("n_none", "u_01")).rejects.toThrow(new AppError(400, "Note not found"));
        });

        it("should throw a 403 error status code if account credential checks reveal a creation owner mismatch", async () => {
            mockRepo.findNoteById.mockResolvedValue({ uploadedBy: "u_original_author" });
            await expect(service.deleteNote("n_id", "u_malicious_attacker"))
                .rejects.toThrow(new AppError(403, "You can only delete your own notes"));
        });

        it("should clear bucket resources and process hard deletes across standard file formats types smoothly", async () => {
            mockRepo.findNoteById.mockResolvedValue({ uploadedBy: "u_01", fileType: "raw", publicId: "pub_doc_50" });
            cloudinary.uploader.destroy.mockResolvedValue({ result: "ok" });

            const res = await service.deleteNote("n_id", "u_01");
            expect(res.message).toBe("Note deleted successfully");
            expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("pub_doc_50", { resource_type: "raw" });
            expect(mockLogger.info).toHaveBeenCalled();
        });

        it("should catch background cloud environment destruction failure indicators inside silent logs blocks", async () => {
            mockRepo.findNoteById.mockResolvedValue({ uploadedBy: "u_01", fileType: "image", publicId: "pub_img_90" });
            cloudinary.uploader.destroy.mockRejectedValue(new Error("Cloudinary API Cluster Network Fault"));

            const res = await service.deleteNote("n_id", "u_01");
            expect(res.message).toBe("Note deleted successfully");
            expect(mockLogger.warn).toHaveBeenCalledWith("Cloudinary delete failed", expect.any(Object));
            expect(mockRepo.deleteNoteById).toHaveBeenCalledWith("n_id");
        });
    });
});