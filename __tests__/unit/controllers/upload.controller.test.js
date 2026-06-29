jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createUploadController = require("../../../controllers/upload.controller");
const { ok } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Upload Controller (Unit)", () => {
    let mockUploadService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockUploadService = {
            uploadProfilePicture: jest.fn(),
            uploadVerificationDocuments: jest.fn(),
        };
        mockLogger = { info: jest.fn(), error: jest.fn() };
        controller = createUploadController(mockUploadService, { logger: mockLogger });

        req = { user: { _id: "user_ctx_123" }, body: {}, file: {}, files: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("uploadProfilePicture", () => {
        it("should accept an uploaded file and respond with a 200 payload envelope", async () => {
            req.file = { originalname: "avatar.jpg", buffer: Buffer.from("img") };
            const servicePayload = { success: true, url: "https://cloudinary.com/avatar.jpg" };
            mockUploadService.uploadProfilePicture.mockResolvedValue({ body: servicePayload });

            await controller.uploadProfilePicture(req, res);

            expect(mockUploadService.uploadProfilePicture).toHaveBeenCalledWith({ file: req.file, user: req.user });
            expect(ok).toHaveBeenCalledWith(res, servicePayload);
        });

        it("should channel execution errors safely to global application handlers", async () => {
            const error = new Error("Cloudinary bucket timeout");
            mockUploadService.uploadProfilePicture.mockRejectedValue(error);

            await controller.uploadProfilePicture(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "upload.uploadProfilePicture");
        });
    });

    describe("uploadVerificationDocuments", () => {
        it("should pass form phone numbers and multiple file structures cleanly into the service", async () => {
            req.body.phoneNumber = "+919876543210";
            req.files = {
                resume: [{ originalname: "cv.pdf" }],
                workExperienceDocs: [{ originalname: "exp1.pdf" }],
            };
            mockUploadService.uploadVerificationDocuments.mockResolvedValue({ body: { success: true } });

            await controller.uploadVerificationDocuments(req, res);

            expect(mockUploadService.uploadVerificationDocuments).toHaveBeenCalledWith({
                phoneNumber: "+919876543210",
                resumeFile: req.files.resume[0],
                workExperienceFiles: req.files.workExperienceDocs,
                user: req.user,
            });
        });
    });
});