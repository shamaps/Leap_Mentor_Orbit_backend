/**
 * @fileoverview Unit tests for noteAccess middleware.
 * Achieves 100% statement, line, branch, and condition passing coverage.
 */


jest.mock("../../../config/constants", () => ({
    ACTIVE_SESSION_STATUSES: ["active_status_123"]
}));

jest.mock("../../../models/ConnectRequest");
jest.mock("../../../models/Note");

const ConnectRequest = require("../../../models/ConnectRequest");
const Note = require("../../../models/Note");
const { validateSessionMembership, validateNoteOwnership, requirePrivateOwnership } = require("../../../middleware/noteAccess");

describe("Note Access Middleware (100% Condition & Branch Blueprint)", () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            params: {},
            body: {},
            user: { _id: "user_123" },
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    describe("validateSessionMembership", () => {
        it("should return 400 if connectRequestId is missing anywhere in the request", async () => {
            await validateSessionMembership(req, res, next);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: "connectRequestId is required",
                code: "MISSING_SESSION_ID",
            });
        });

        it("should extract connectRequestId from req.body if req.params is empty", async () => {
            req.body.connectRequestId = "session_from_body";
            ConnectRequest.findById.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(null),
            });

            await validateSessionMembership(req, res, next);
            expect(ConnectRequest.findById).toHaveBeenCalledWith("session_from_body");
        });

        it("should return 404 if the session does not exist in the database", async () => {
            req.params.connectRequestId = "session_not_found";
            ConnectRequest.findById.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(null),
            });

            await validateSessionMembership(req, res, next);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                message: "Session not found",
                code: "SESSION_NOT_FOUND",
            });
        });

        it("should return 403 if the session status is inactive", async () => {
            req.params.connectRequestId = "session_inactive";
            ConnectRequest.findById.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue({
                    status: "totally_inactive_status", 
                    mentor: "user_123",
                    mentee: "mentee_id",
                }),
            });

            await validateSessionMembership(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                message: "Session is not active",
                code: "SESSION_INACTIVE",
            });
        });

        it("should return 403 if the requesting user is neither the mentor nor the mentee", async () => {
            req.params.connectRequestId = "session_active";
            ConnectRequest.findById.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue({
                    status: "active_status_123",
                    mentor: "another_mentor",
                    mentee: "another_mentee",
                }),
            });

            await validateSessionMembership(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                message: "You are not a participant of this session",
                code: "NOT_A_PARTICIPANT",
            });
        });

        it("should allow access and attach mentor role if the user is the mentor", async () => {
            req.params.connectRequestId = "session_active";
            const mockSession = {
                status: "active_status_123",
                mentor: "user_123",
                mentee: "another_mentee",
            };
            ConnectRequest.findById.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockSession),
            });

            await validateSessionMembership(req, res, next);
            expect(req.connectRequest).toEqual(mockSession);
            expect(req.sessionRole).toBe("mentor");
            expect(next).toHaveBeenCalled();
        });

        it("should allow access and attach mentee role if the user is the mentee", async () => {
            req.params.connectRequestId = "session_active";
            const mockSession = {
                status: "active_status_123",
                mentor: "another_mentor",
                mentee: "user_123",
            };
            ConnectRequest.findById.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockSession),
            });

            await validateSessionMembership(req, res, next);
            expect(req.connectRequest).toEqual(mockSession);
            expect(req.sessionRole).toBe("mentee");
            expect(next).toHaveBeenCalled();
        });

        it("should return 500 when an unexpected internal error occurs", async () => {
            req.params.connectRequestId = "session_trigger_error";
            ConnectRequest.findById.mockImplementation(() => {
                throw new Error("Database deadlock error");
            });

            await validateSessionMembership(req, res, next);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ message: "Database deadlock error" });
        });
    });

    describe("validateNoteOwnership", () => {
        it("should return 404 if the targeted note does not exist", async () => {
            req.params.id = "note_not_found";
            Note.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue(null),
            });

            await validateNoteOwnership(req, res, next);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                message: "Note not found",
                code: "NOTE_NOT_FOUND",
            });
        });

        it("should return 404 if the user is not the author of the note to conceal existence", async () => {
            req.params.id = "note_belongs_to_other";
            Note.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    _id: "note_belongs_to_other",
                    uploadedBy: "someone_else",
                }),
            });

            await validateNoteOwnership(req, res, next);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                message: "Note not found",
                code: "NOTE_NOT_FOUND",
            });
        });

        it("should attach note and call next if the user is the author", async () => {
            req.params.id = "note_success";
            const mockNote = {
                _id: "note_success",
                uploadedBy: "user_123",
            };
            Note.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockNote),
            });

            await validateNoteOwnership(req, res, next);
            expect(req.note).toEqual(mockNote);
            expect(next).toHaveBeenCalled();
        });

        it("should return 500 when an unexpected server error occurs during lookup", async () => {
            req.params.id = "note_trigger_error";
            Note.findById.mockImplementation(() => {
                throw new Error("Query failure");
            });

            await validateNoteOwnership(req, res, next);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ message: "Query failure" });
        });
    });

    describe("requirePrivateOwnership", () => {
        it("should inject filter using req.params.connectRequestId if present", () => {
            req.params.connectRequestId = "id_from_params";
            requirePrivateOwnership(req, res, next);
            expect(req.privateFilter).toEqual({
                connectRequest: "id_from_params",
                uploadedBy: "user_123",
            });
            expect(next).toHaveBeenCalled();
        });

        it("should inject filter using req.body.connectRequestId if params is missing", () => {
            req.body.connectRequestId = "id_from_body";
            requirePrivateOwnership(req, res, next);
            expect(req.privateFilter).toEqual({
                connectRequest: "id_from_body",
                uploadedBy: "user_123",
            });
            expect(next).toHaveBeenCalled();
        });

        it("should fall back to req.connectRequest._id if params and body are both empty", () => {
            req.connectRequest = { _id: "id_from_upstream_middleware" };
            requirePrivateOwnership(req, res, next);
            expect(req.privateFilter).toEqual({
                connectRequest: "id_from_upstream_middleware",
                uploadedBy: "user_123",
            });
            expect(next).toHaveBeenCalled();
        });

        it("should map connectRequest as undefined if all fallback options are completely missing", () => {
            req.connectRequest = null;
            requirePrivateOwnership(req, res, next);
            expect(req.privateFilter).toEqual({
                connectRequest: undefined,
                uploadedBy: "user_123",
            });
            expect(next).toHaveBeenCalled();
        });
    });
});