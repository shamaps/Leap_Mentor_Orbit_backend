/**
 * @fileoverview Unit tests for Note Controller.
 * Secures 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(500).json({ error: err.message, context })),
}));

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json(data)),
    created: jest.fn((res, data) => res.status(201).json(data)),
    fail: jest.fn((res, msg, status) => res.status(status).json({ error: msg })),
    noContent: jest.fn((res) => res.status(204).send()),
}));

const createNoteController = require("../../../controllers/note.controller");
const { handleError } = require("../../../utils/appError");
const { ok, created, fail, noContent } = require("../../../utils/response");

describe("Note Controller (100% Comprehensive Coverage Blueprint)", () => {
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

        req = {
            params: { connectRequestId: "cr_123", id: "note_555" },
            body: { title: "Lecture Notes", isPrivate: "false" },
            file: { buffer: Buffer.from(""), mimetype: "application/pdf" },
            user: { _id: "user_777" },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        };

        jest.clearAllMocks();
    });

    describe("uploadNote Endpoint", () => {
        it("should return created metadata entries upon a successful file upload", async () => {
            const mockData = { id: "note_555", url: "https://cloudinary.com/doc" };
            mockNoteService.uploadNote.mockResolvedValue(mockData);

            await controller.uploadNote(req, res);

            expect(mockNoteService.uploadNote).toHaveBeenCalledWith("user_777", req.body, req.file);
            expect(created).toHaveBeenCalledWith(res, mockData);
        });

        it("should return a custom 400 validation response error if Multer throws a LIMIT_FILE_SIZE exception", async () => {
            // CONDITION COVERAGE GAPS FILLED: err.code === "LIMIT_FILE_SIZE" evaluates to true
            const sizeError = new Error("File chunk too big");
            sizeError.code = "LIMIT_FILE_SIZE";
            mockNoteService.uploadNote.mockRejectedValue(sizeError);

            await controller.uploadNote(req, res);

            expect(fail).toHaveBeenCalledWith(res, "File too large. Maximum size is 10MB.", 400);
        });

        it("should forward generic runtime service exceptions straight down to the handleError helper", async () => {
            // CONDITION COVERAGE GAPS FILLED: err.code === "LIMIT_FILE_SIZE" evaluates to false
            const randomError = new Error("Cloudinary connection lost error");
            mockNoteService.uploadNote.mockRejectedValue(randomError);

            await controller.uploadNote(req, res);

            expect(handleError).toHaveBeenCalledWith(res, randomError, "note.uploadNote");
        });
    });

    describe("getNotes Endpoint", () => {
        it("should return a list of public attachments within the session successfully", async () => {
            const mockList = [{ id: "note_1" }];
            mockNoteService.getNotes.mockResolvedValue(mockList);

            await controller.getNotes(req, res);

            expect(mockNoteService.getNotes).toHaveBeenCalledWith("cr_123", "user_777");
            expect(ok).toHaveBeenCalledWith(res, mockList);
        });

        it("should route service read failures down through handleError handler", async () => {
            const err = new Error("Public list read failure");
            mockNoteService.getNotes.mockRejectedValue(err);

            await controller.getNotes(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "note.getNotes");
        });
    });

    describe("getPrivateNotes Endpoint", () => {
        it("should extract restricted credential metadata rows collections successfully", async () => {
            const mockPrivateList = [{ id: "note_2", isPrivate: true }];
            mockNoteService.getPrivateNotes.mockResolvedValue(mockPrivateList);

            await controller.getPrivateNotes(req, res);

            expect(mockNoteService.getPrivateNotes).toHaveBeenCalledWith("cr_123", "user_777");
            expect(ok).toHaveBeenCalledWith(res, mockPrivateList);
        });

        it("should route private listing exceptions directly to handleError", async () => {
            const err = new Error("Private notes read error");
            mockNoteService.getPrivateNotes.mockRejectedValue(err);

            await controller.getPrivateNotes(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "note.getPrivateNotes");
        });
    });

    describe("deleteNote Endpoint", () => {
        it("should execute asset purges cleanly and issue noContent statements", async () => {
            mockNoteService.deleteNote.mockResolvedValue({ success: true });

            await controller.deleteNote(req, res);

            expect(mockNoteService.deleteNote).toHaveBeenCalledWith("note_555", "user_777");
            expect(noContent).toHaveBeenCalledWith(res);
        });

        it("should send delete route exceptions through to handleError", async () => {
            const err = new Error("Deletion permission denied");
            mockNoteService.deleteNote.mockRejectedValue(err);

            await controller.deleteNote(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "note.deleteNote");
        });
    });
});