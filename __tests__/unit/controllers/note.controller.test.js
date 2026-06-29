jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
    created: jest.fn((res, data) => res.status(201).json({ success: true, data })),
    fail: jest.fn((res, msg, status) => res.status(status).json({ success: false, error: msg })),
    noContent: jest.fn((res) => res.status(204).send()),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createNoteController = require("../../../controllers/note.controller");
const { ok, created, fail, noContent } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Note Controller (Unit)", () => {
    let mockNoteService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockNoteService = {
            uploadNote: jest.fn(),
            getNotes: jest.fn(),
            getPrivateNotes: jest.fn(),
            deleteNote: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createNoteController(mockNoteService, { logger: mockLogger });

        req = { user: { _id: "user_uploader_123" }, body: {}, params: {}, file: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("uploadNote", () => {
        it("should process multipart file uploads and return status 201 on success", async () => {
            req.body = { connectRequestId: "session_abc" };
            req.file = { originalname: "diagram.png", buffer: Buffer.from("abc") };
            const servicePayload = { message: "Note uploaded successfully", note: {} };
            mockNoteService.uploadNote.mockResolvedValue(servicePayload);

            await controller.uploadNote(req, res);

            expect(mockNoteService.uploadNote).toHaveBeenCalledWith("user_uploader_123", req.body, req.file);
            expect(created).toHaveBeenCalledWith(res, servicePayload);
        });

        it("should capture Multer file limit errors and return a customized status 400 failure", async () => {
            const multerError = new Error("File too large");
            multerError.code = "LIMIT_FILE_SIZE";
            mockNoteService.uploadNote.mockRejectedValue(multerError);

            await controller.uploadNote(req, res);

            expect(fail).toHaveBeenCalledWith(res, "File too large. Maximum size is 10MB.", 400);
            expect(handleError).not.toHaveBeenCalled();
        });
    });

    describe("deleteNote", () => {
        it("should invoke service deletions and resolve with a 204 noContent state wrapper", async () => {
            req.params.id = "note_target_999";
            mockNoteService.deleteNote.mockResolvedValue({ message: "Deleted" });

            await controller.deleteNote(req, res);

            expect(mockNoteService.deleteNote).toHaveBeenCalledWith("note_target_999", "user_uploader_123");
            expect(noContent).toHaveBeenCalledWith(res);
        });
    });
});