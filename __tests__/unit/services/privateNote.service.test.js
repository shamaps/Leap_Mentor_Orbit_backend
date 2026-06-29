jest.mock("../../../utils/sessionAccess", () => ({
    validateSessionAccess: jest.fn(),
}));

const createPrivateNoteService = require("../../../services/privateNote.service");
const { validateSessionAccess } = require("../../../utils/sessionAccess");

describe("Private Note Service (Unit)", () => {
    let mockRepo, mockLogger, service;

    beforeEach(() => {
        mockRepo = {
            findSessionParticipants: jest.fn(),
            createNote: jest.fn(),
            findNotesByUser: jest.fn(),
            findNoteById: jest.fn(),
            deleteNoteById: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createPrivateNoteService(mockRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    describe("createNote", () => {
        it("should throw AppError 400 if the incoming connectRequestId is completely missing", async () => {
            await expect(service.createNote("user_1", {}))
                .rejects.toMatchObject({ status: 400, message: "connectRequestId is required" });
        });

        it("should throw authorization exceptions if relationship validation checkpoints fail", async () => {
            validateSessionAccess.mockResolvedValue({ valid: false, status: 403, reason: "Not an active party" });

            await expect(service.createNote("user_1", { connectRequestId: "session_1" }))
                .rejects.toMatchObject({ status: 403, message: "Not an active party" });
        });

        it("should assign fallback titles if title string elements are omitted during additions", async () => {
            validateSessionAccess.mockResolvedValue({ valid: true, uploaderRole: "mentor" });
            mockRepo.createNote.mockResolvedValue({ title: "Untitled Note" });

            await service.createNote("user_1", { connectRequestId: "session_1", content: "Quick draft" });

            expect(mockRepo.createNote).toHaveBeenCalledWith(expect.objectContaining({
                title: "Untitled Note",
                content: "Quick draft",
            }));
        });
    });

    describe("updateNote", () => {
        it("should throw AppError 403 if the active modifier token mismatches the original author property", async () => {
            mockRepo.findNoteById.mockResolvedValue({ author: "original_author_id" });

            await expect(service.updateNote("note_1", "malicious_editor_id", { title: "Hacked" }))
                .rejects.toMatchObject({ status: 403, message: "Not authorized" });
        });

        it("should mutate properties and call the document save tracker method when parameters clear authorization checks", async () => {
            const mockNoteDoc = {
                author: "author_123",
                title: "Old title",
                content: "Old text",
                save: jest.fn().mockResolvedValue(),
            };
            mockRepo.findNoteById.mockResolvedValue(mockNoteDoc);

            await service.updateNote("note_1", "author_123", { title: "  Clean Title   ", content: "Refreshed content text" });

            expect(mockNoteDoc.title).toBe("Clean Title");
            expect(mockNoteDoc.content).toBe("Refreshed content text");
            expect(mockNoteDoc.save).toHaveBeenCalled();
        });
    });
});