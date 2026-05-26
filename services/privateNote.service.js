// services/privateNote.service.js
const privateNoteRepo = require("../repositories/privateNote.repository");

// ── Helper: confirm user is a session participant ─────────────
const validateSessionAccess = async (connectRequestId, userId) => {
    const request = await privateNoteRepo.findSessionParticipants(connectRequestId);
    if (!request) {
        return { valid: false, reason: "Session not found", status: 404 };
    }
    if (!["ongoing", "completed"].includes(request.status)) {
        return { valid: false, reason: "Session is not active", status: 400 };
    }
    const uid = userId.toString();
    if (request.mentor.toString() !== uid && request.mentee.toString() !== uid) {
        return { valid: false, reason: "Not authorized", status: 403 };
    }
    return { valid: true };
};

// ─────────────────────────────────────────────────────────────
// POST /api/private-notes
// ─────────────────────────────────────────────────────────────
const createNote = async (userId, body) => {
    const { connectRequestId, title, content } = body;

    if (!connectRequestId) {
        const err = new Error("connectRequestId is required");
        err.statusCode = 400;
        throw err;
    }

    const access = await validateSessionAccess(connectRequestId, userId);
    if (!access.valid) {
        const err = new Error(access.reason);
        err.statusCode = access.status;
        throw err;
    }

    const note = await privateNoteRepo.createNote({
        connectRequest: connectRequestId,
        author: userId,
        title: title?.trim() || "Untitled Note",
        content: content || "",
    });

    return { note };
};

// ─────────────────────────────────────────────────────────────
// GET /api/private-notes/:connectRequestId
// ─────────────────────────────────────────────────────────────
const getNotes = async (connectRequestId, userId) => {
    const access = await validateSessionAccess(connectRequestId, userId);
    if (!access.valid) {
        const err = new Error(access.reason);
        err.statusCode = access.status;
        throw err;
    }

    const notes = await privateNoteRepo.findNotesByUser(connectRequestId, userId);
    return { notes };
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/private-notes/:id
// ─────────────────────────────────────────────────────────────
const updateNote = async (noteId, userId, body) => {
    const note = await privateNoteRepo.findNoteById(noteId);

    if (!note) {
        const err = new Error("Note not found");
        err.statusCode = 404;
        throw err;
    }
    if (note.author.toString() !== userId.toString()) {
        const err = new Error("Not authorized");
        err.statusCode = 403;
        throw err;
    }

    if (body.title !== undefined) note.title = body.title.trim() || "Untitled Note";
    if (body.content !== undefined) note.content = body.content;

    await note.save();
    return { note };
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/private-notes/:id
// ─────────────────────────────────────────────────────────────
const deleteNote = async (noteId, userId) => {
    const note = await privateNoteRepo.findNoteById(noteId);

    if (!note) {
        const err = new Error("Note not found");
        err.statusCode = 404;
        throw err;
    }
    if (note.author.toString() !== userId.toString()) {
        const err = new Error("Not authorized");
        err.statusCode = 403;
        throw err;
    }

    await privateNoteRepo.deleteNoteById(noteId);
    return { message: "Note deleted" };
};

module.exports = { createNote, getNotes, updateNote, deleteNote };