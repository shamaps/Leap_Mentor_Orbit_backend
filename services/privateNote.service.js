// services/privateNote.service.js
const { ACTIVE_SESSION_STATUSES } = require("../config/constants");
const { validateSessionAccess } = require("../utils/sessionAccess");
const AppError = require("../utils/appError");
const createPrivateNoteService = (privateNoteRepo, { logger }) => {

// POST /api/private-notes

const createNote = async (userId, body) => {
    const { connectRequestId, title, content } = body;

    if (!connectRequestId) {
        throw new AppError(400, "connectRequestId is required");
    }

    const access = await validateSessionAccess(privateNoteRepo.findSessionParticipants, connectRequestId, userId);
    if (!access.valid) {
        throw new AppError(access.status, access.reason);
    }

    const note = await privateNoteRepo.createNote({
        connectRequest: connectRequestId,
        author: userId,
        title: title?.trim() || "Untitled Note",
        content: content || "",
    });

    return { note };
};


// GET /api/private-notes/:connectRequestId

const getNotes = async (connectRequestId, userId) => {
    const access = await validateSessionAccess(privateNoteRepo.findSessionParticipants, connectRequestId, userId);
    if (!access.valid) {
        throw new AppError(access.status, access.reason);
    }

    const notes = await privateNoteRepo.findNotesByUser(connectRequestId, userId);
    return { notes };
};


// PATCH /api/private-notes/:id

const updateNote = async (noteId, userId, body) => {
    const note = await privateNoteRepo.findNoteById(noteId);

    if (!note) {
        throw new AppError(404, "Note not found");
    }
    if (note.author.toString() !== userId.toString()) {
        throw new AppError(403, "Not authorized");
    }

    if (body.title !== undefined) note.title = body.title.trim() || "Untitled Note";
    if (body.content !== undefined) note.content = body.content;

    await note.save();
    return { note };
};


// DELETE /api/private-notes/:id

const deleteNote = async (noteId, userId) => {
    const note = await privateNoteRepo.findNoteById(noteId);

    if (!note) {
        throw new AppError(404, "Note not found");
    }
    if (note.author.toString() !== userId.toString()) {
        throw new AppError(403, "Not authorized");
    }

    await privateNoteRepo.deleteNoteById(noteId);
    return { message: "Note deleted" };
};

    return { createNote, getNotes, updateNote, deleteNote };
};
module.exports = createPrivateNoteService;