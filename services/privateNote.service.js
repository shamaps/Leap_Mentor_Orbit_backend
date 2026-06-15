// services/privateNote.service.js
const privateNoteRepo = require("../repositories/privateNote.repository");
const { ACTIVE_SESSION_STATUSES } = require("../config/constants");
const logger = require("../utils/logger");
const { validateSessionAccess } = require("../utils/sessionAccess");

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

    const access = await validateSessionAccess(privateNoteRepo.findSessionParticipants, connectRequestId, userId);
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
    const access = await validateSessionAccess(privateNoteRepo.findSessionParticipants, connectRequestId, userId);
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