jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
    created: jest.fn((res, data) => res.status(201).json({ success: true, data })),
    noContent: jest.fn((res) => res.status(204).send()),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createPrivateNoteController = require("../../../controllers/privateNote.controller");
const { ok, created, noContent } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Private Note Controller (Unit)", () => {
    let mockPrivateNoteService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockPrivateNoteService = {
            createNote: jest.fn(),
            getNotes: jest.fn(),
            updateNote: jest.fn(),
            deleteNote: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createPrivateNoteController(mockPrivateNoteService, { logger: mockLogger });

        req = { user: { _id: "user_author_111" }, body: {}, params: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("createNote", () => {
        it("should accept valid text attributes and return status 201 upon successful allocation", async () => {
            req.body = { connectRequestId: "session_id_xyz", title: "Review items", content: "Check design patterns" };
            const servicePayload = { note: { title: "Review items" } };
            mockPrivateNoteService.createNote.mockResolvedValue(servicePayload);

            await controller.createNote(req, res);

            expect(mockPrivateNoteService.createNote).toHaveBeenCalledWith("user_author_111", req.body);
            expect(created).toHaveBeenCalledWith(res, servicePayload);
        });

        it("should catch runtime evaluation crashes and securely route them to global handlers", async () => {
            const error = new Error("Database transaction dropped");
            mockPrivateNoteService.createNote.mockRejectedValue(error);

            await controller.createNote(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "privateNote.createNote");
        });
    });

    describe("updateNote", () => {
        it("should process structural updates and deliver changes in a status 200 wrapper", async () => {
            req.params.id = "note_id_555";
            req.body = { content: "Updated inline documentation details" };
            mockPrivateNoteService.updateNote.mockResolvedValue({ note: { _id: "note_id_555" } });

            await controller.updateNote(req, res);

            expect(mockPrivateNoteService.updateNote).toHaveBeenCalledWith("note_id_555", "user_author_111", req.body);
            expect(ok).toHaveBeenCalledWith(res, { note: { _id: "note_id_555" } });
        });
    });
});