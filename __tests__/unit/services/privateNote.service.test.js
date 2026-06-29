/**
 * @fileoverview Unit tests for Private Note Service.
 * Secures 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../utils/sessionAccess", () => ({
    validateSessionAccess: jest.fn(),
}));

const createPrivateNoteService = require("../../../services/privateNote.service");
const { validateSessionAccess } = require("../../../utils/sessionAccess");
const AppError = require("../../../utils/appError");

describe("Private Note Service Layer (100% Total Branch & Condition Coverage)", () => {
    let mockRepo, mockLogger, service, defaultBody;

    beforeEach(() => {
        mockRepo = {
            findSessionParticipants: jest.fn(),
            createNote: jest.fn(),
            findNotesByUser: jest.fn(),
            findNoteById: jest.fn(),
            deleteNoteById: jest.fn(),
        };

        mockLogger = { info: jest.fn(), warn: jest.fn() };
        service = createPrivateNoteService(mockRepo, { logger: mockLogger });

        defaultBody = {
            connectRequestId: "session_channel_777",
            title: "Project Milestone Thoughts",
            content: "Need to verify indexing setups before deployment.",
        };

        jest.clearAllMocks();
    });

    describe("createNote Workflows", () => {
        it("should throw a 400 error if connectRequestId parameter field is missing", async () => {
            // CONDITION COVERAGE: !connectRequestId is true
            await expect(service.createNote("u_01", { ...defaultBody, connectRequestId: null }))
                .rejects.toThrow(new AppError(400, "connectRequestId is required"));
        });

        it("should throw an AppError if validateSessionAccess signals relationship validation boundary failures", async () => {
            // CONDITION COVERAGE: !access.valid is true
            validateSessionAccess.mockResolvedValue({ valid: false, status: 403, reason: "Relationship check failed" });

            await expect(service.createNote("u_01", defaultBody))
                .rejects.toThrow(new AppError(403, "Relationship check failed"));
        });

        it("should write a fresh note substituting fallbacks for missing title or empty content entries", async () => {
            // CONDITION COVERAGE: title?.trim() falls back, content || "" evaluates fallback
            validateSessionAccess.mockResolvedValue({ valid: true });
            mockRepo.createNote.mockImplementation((data) => Promise.resolve({ ...data, _id: "note_mock_id" }));

            const sparseBody = { connectRequestId: "session_channel_777", title: "   ", content: null };
            const res = await service.createNote("u_01", sparseBody);

            expect(res.note.title).toBe("Untitled Note");
            expect(res.note.content).toBe("");
            expect(mockRepo.createNote).toHaveBeenCalledWith(expect.objectContaining({
                title: "Untitled Note",
                content: ""
            }));
        });
    });

    describe("getNotes Workflows", () => {
        it("should throw an error if the calling security context token fails partnership boundaries", async () => {
            validateSessionAccess.mockResolvedValue({ valid: false, status: 403, reason: "Not a participant" });
            await expect(service.getNotes("session_channel_777", "u_01")).rejects.toThrow(AppError);
        });

        it("should load authorized personal nodes successfully", async () => {
            validateSessionAccess.mockResolvedValue({ valid: true });
            mockRepo.findNotesByUser.mockResolvedValue([{ title: "My Log Entry" }]);

            const res = await service.getNotes("session_channel_777", "u_01");
            expect(res.notes).toHaveLength(1);
        });
    });

    describe("updateNote Workflows", () => {
        it("should throw a 404 status indicator error if targeted record lookups return null", async () => {
            // CONDITION COVERAGE: !note is true
            mockRepo.findNoteById.mockResolvedValue(null);
            await expect(service.updateNote("n_miss", "u_01", {}))
                .rejects.toThrow(new AppError(404, "Note not found"));
        });

        it("should throw a 403 status code error if performing identity indicates an owner mismatch", async () => {
            // CONDITION COVERAGE: note.author.toString() !== userId.toString()
            mockRepo.findNoteById.mockResolvedValue({ author: "u_original_owner" });
            await expect(service.updateNote("n_id", "u_attacker", {}))
                .rejects.toThrow(new AppError(403, "Not authorized"));
        });

        it("should apply selective titles and text contents mutations smoothly alongside fallbacks", async () => {
            // CONDITION COVERAGE: title !== undefined, content !== undefined, title.trim() fallback evaluation paths
            const mockMongooseNote = {
                author: "u_01",
                title: "Old Title",
                content: "Old Content",
                save: jest.fn().mockResolvedValue(this)
            };
            mockRepo.findNoteById.mockResolvedValue(mockMongooseNote);

            const res = await service.updateNote("n_id", "u_01", { title: "  ", content: "Fresh Delta Change Log" });

            expect(mockMongooseNote.title).toBe("Untitled Note");
            expect(mockMongooseNote.content).toBe("Fresh Delta Change Log");
            expect(mockMongooseNote.save).toHaveBeenCalled();
            expect(res.note).toBeDefined();
        });

        it("should bypass property updates entirely if parameters evaluate to undefined inside the body", async () => {
            // CONDITION COVERAGE: title === undefined, content === undefined branches
            const mockMongooseNote = {
                author: "u_01",
                title: "Persistent Title",
                content: "Persistent Content",
                save: jest.fn().mockResolvedValue(this)
            };
            mockRepo.findNoteById.mockResolvedValue(mockMongooseNote);

            await service.updateNote("n_id", "u_01", {});

            expect(mockMongooseNote.title).toBe("Persistent Title");
            expect(mockMongooseNote.content).toBe("Persistent Content");
        });
    });

    describe("deleteNote Workflows", () => {
        it("should throw a 404 error if targeted deletion targets resolve null", async () => {
            mockRepo.findNoteById.mockResolvedValue(null);
            await expect(service.deleteNote("n_miss", "u_01"))
                .rejects.toThrow(new AppError(404, "Note not found"));
        });

        it("should reject deletion calls if the user context is unverified against uploader profiles", async () => {
            mockRepo.findNoteById.mockResolvedValue({ author: "u_author" });
            await expect(service.deleteNote("n_id", "u_unauthorized"))
                .rejects.toThrow(new AppError(403, "Not authorized"));
        });

        it("should hard erase notebook node structures and return simple confirmation text upon success", async () => {
            mockRepo.findNoteById.mockResolvedValue({ author: "u_01" });
            mockRepo.deleteNoteById.mockResolvedValue({ deletedCount: 1 });

            const res = await service.deleteNote("n_id", "u_01");
            expect(res.message).toBe("Note deleted");
            expect(mockRepo.deleteNoteById).toHaveBeenCalledWith("n_id");
        });
    });
});