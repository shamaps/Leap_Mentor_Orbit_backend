/**
 * @fileoverview Unit tests for Upload Controller.
 * Achieves 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(500).json({ error: err.message, context })),
}));

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json(data)),
}));

const createUploadController = require("../../../controllers/upload.controller");
const { handleError } = require("../../../utils/appError");
const { ok } = require("../../../utils/response");

describe("Upload Controller (100% Full Branch Coverage Blueprint)", () => {
    let mockUploadService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockUploadService = {
            uploadProfilePicture: jest.fn(),
            uploadVerificationDocuments: jest.fn(),
        };

        mockLogger = { info: jest.fn(), error: jest.fn() };
        controller = createUploadController(mockUploadService, { logger: mockLogger });

        req = {
            body: { phoneNumber: "+1234567890" },
            user: { _id: "user_upload_555" },
            file: { buffer: Buffer.from("avatar"), mimetype: "image/png", originalname: "me.png" },
            files: {
                resume: [{ buffer: Buffer.from("pdf"), mimetype: "application/pdf" }],
                workExperienceDocs: [{ buffer: Buffer.from("doc"), mimetype: "image/jpeg" }]
            }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        jest.clearAllMocks();
    });

    describe("uploadProfilePicture Endpoint", () => {
        it("should successfully upload a single avatar file and return 200 ok", async () => {
            const mockBody = { url: "https://cloudinary.com/avatar.png" };
            mockUploadService.uploadProfilePicture.mockResolvedValue({ body: mockBody });

            await controller.uploadProfilePicture(req, res);

            expect(mockUploadService.uploadProfilePicture).toHaveBeenCalledWith({
                file: req.file,
                user: req.user
            });
            expect(ok).toHaveBeenCalledWith(res, mockBody);
        });

        it("should forward runtime single upload errors straight to handleError", async () => {
            const err = new Error("Cloudinary buffer upload timeout");
            mockUploadService.uploadProfilePicture.mockRejectedValue(err);

            await controller.uploadProfilePicture(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "upload.uploadProfilePicture");
        });
    });

    describe("uploadVerificationDocuments Endpoint", () => {
        it("should parse explicit structural form files arrays maps successfully", async () => {
            // CONDITION COVERAGE GAPS FILLED: req.files attributes evaluate to truthy paths
            const mockBody = { success: true, status: "pending_review" };
            mockUploadService.uploadVerificationDocuments.mockResolvedValue({ body: mockBody });

            await controller.uploadVerificationDocuments(req, res);

            expect(mockUploadService.uploadVerificationDocuments).toHaveBeenCalledWith({
                phoneNumber: "+1234567890",
                resumeFile: req.files.resume[0],
                workExperienceFiles: req.files.workExperienceDocs,
                user: req.user
            });
            expect(ok).toHaveBeenCalledWith(res, mockBody);
        });

        it("should gracefully resolve fallback assignments when dynamic files arrays are missing or undefined", async () => {
            // CONDITION COVERAGE GAPS FILLED: Optional chain and logical OR fallbacks are verified
            req.files = null;
            const mockBody = { success: true };
            mockUploadService.uploadVerificationDocuments.mockResolvedValue({ body: mockBody });

            await controller.uploadVerificationDocuments(req, res);

            expect(mockUploadService.uploadVerificationDocuments).toHaveBeenCalledWith({
                phoneNumber: "+1234567890",
                resumeFile: undefined,
                workExperienceFiles: [],
                user: req.user
            });
        });

        it("should catch unexpected attachment processing faults within handleError", async () => {
            const err = new Error("File array parsing payload validation error");
            mockUploadService.uploadVerificationDocuments.mockRejectedValue(err);

            await controller.uploadVerificationDocuments(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "upload.uploadVerificationDocuments");
        });
    });
});