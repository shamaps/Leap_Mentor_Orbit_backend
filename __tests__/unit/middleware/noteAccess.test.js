const ConnectRequest = require("../../../models/ConnectRequest");
const Note = require("../../../models/Note");
const { validateSessionMembership, validateNoteOwnership, requirePrivateOwnership } = require("../../../middleware/noteAccess");

jest.mock("../../../models/ConnectRequest");
jest.mock("../../../models/Note");

describe("Session Notes Access Management Middleware (Unit)", () => {
    let req, res, next;

    beforeEach(() => {
        req = { user: { _id: "user_actor_id" }, params: {}, body: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    describe("validateSessionMembership", () => {
        it("should pass an error with status 403 if user is not a mentor or mentee participant on the request document", async () => {
            req.params.connectRequestId = "session_id_123";

            const mockSession = {
                mentor: "different_mentor_id",
                mentee: "different_mentee_id",
                status: "ongoing"
            };

            ConnectRequest.findById.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockSession)
            });

            await validateSessionMembership(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "NOT_A_PARTICIPANT" }));
        });
    });

    describe("validateNoteOwnership", () => {
        it("should obscure structural trace existence by intentionally returning a 404 instead of a 403 if the author doesn't match", async () => {
            req.params.id = "target_note_id";
            const mockNote = { uploadedBy: "someone_else_id" };

            Note.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockNote)
            });

            await validateNoteOwnership(req, res, next);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "NOTE_NOT_FOUND" }));
        });
    });

    describe("requirePrivateOwnership", () => {
        it("should successfully construct and append private mapping query filters onto the request envelope", () => {
            req.params.connectRequestId = "connect_id_abc";

            requirePrivateOwnership(req, res, next);

            expect(req.privateFilter).toEqual({
                connectRequest: "connect_id_abc",
                uploadedBy: "user_actor_id"
            });
            expect(next).toHaveBeenCalledTimes(1);
        });
    });
});