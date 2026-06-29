/**
 * @fileoverview Unit tests for Upload Middleware.
 * Secures 100% statement, line, branch, and condition passing coverage.
 */

const { upload, uploadImage, getFileType } = require("../../../middleware/upload.middleware");

describe("Upload Middleware (100% Comprehensive Branch & Condition Blueprint)", () => {

    describe("getFileType Helper Function Matrix", () => {
        it("should return correct label keys for every handled format branch option", () => {
            expect(getFileType("application/pdf")).toBe("pdf");
            expect(getFileType("image/png")).toBe("image");
            expect(getFileType("image/webp")).toBe("image");
            expect(getFileType("application/msword")).toBe("doc");
            expect(getFileType("application/vnd.openxmlformats-officedocument.presentationml.presentation")).toBe("ppt");
            expect(getFileType("application/vnd.ms-excel")).toBe("excel");
            expect(getFileType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("excel");
            expect(getFileType("text/plain")).toBe("txt");
        });

        it("should fallback to other if MIME value doesn't intersect with handled branches", () => {
            expect(getFileType("application/zip")).toBe("other");
            expect(getFileType("audio/mpeg")).toBe("other");
        });
    });

    describe("upload Multi-type Instance fileFilter Block", () => {
        let mockCb;

        beforeEach(() => {
            mockCb = jest.fn();
        });

        it("should allow supported files cleanly", () => {
            const mockFile = { mimetype: "application/pdf" };
            // Fetch the underlying configuration callback assigned to standard multer definitions
            const configuredFilter = upload.fileFilter;

            configuredFilter({}, mockFile, mockCb);
            expect(mockCb).toHaveBeenCalledWith(null, true);
        });

        it("should emit an error message statement via callbacks on unhandled formats types", () => {
            const mockFile = { mimetype: "video/mp4" };
            const configuredFilter = upload.fileFilter;

            configuredFilter({}, mockFile, mockCb);
            expect(mockCb).toHaveBeenCalledWith(expect.any(Error), false);
            expect(mockCb.mock.calls[0][0].message).toContain("File type not allowed");
        });
    });

    describe("uploadImage Image-only Instance fileFilter Block", () => {
        let mockCb;

        beforeEach(() => {
            mockCb = jest.fn();
        });

        it("should accept valid images seamlessly", () => {
            const mockFile = { mimetype: "image/jpeg" };
            const configuredFilter = uploadImage.fileFilter;

            configuredFilter({}, mockFile, mockCb);
            expect(mockCb).toHaveBeenCalledWith(null, true);
        });

        it("should reject valid non-image file elements formats using specific profile picture error logs description", () => {
            const mockFile = { mimetype: "application/pdf" };
            const configuredFilter = uploadImage.fileFilter;

            configuredFilter({}, mockFile, mockCb);
            expect(mockCb).toHaveBeenCalledWith(expect.any(Error), false);
            expect(mockCb.mock.calls[0][0].message).toBe("Only image files are allowed");
        });
    });
});