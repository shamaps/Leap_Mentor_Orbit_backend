const { getFileType, upload, uploadImage } = require("../../../middleware/upload.middleware");

describe("Multer Asset Processing Controls (Unit)", () => {
    describe("getFileType MIME conversion mapping rules", () => {
        it("should correctly label standard asset variants according to schema expectations", () => {
            expect(getFileType("application/pdf")).toBe("pdf");
            expect(getFileType("image/webp")).toBe("image");
            expect(getFileType("application/vnd.ms-excel")).toBe("excel");
            expect(getFileType("video/mp4")).toBe("other");
        });
    });

    describe("Multer instance generation checkpoints", () => {
        it("should properly structure multi-format filters and single image storage limits criteria", () => {
            expect(upload).toBeDefined();
            expect(uploadImage).toBeDefined();
        });
    });
});