// repositories/privateNote.repository.js
const PrivateNote = require("../models/PrivateNote");
const ConnectRequest = require("../models/ConnectRequest");

// ─── ConnectRequest ──────────────────────────────────────────

const findSessionParticipants = (connectRequestId) =>
    ConnectRequest.findById(connectRequestId)
        .select("mentor mentee status")
        .lean();

// ─── PrivateNote ─────────────────────────────────────────────

const createNote = (data) =>
    PrivateNote.create(data);

const findNotesByUser = (connectRequestId, userId) =>
    PrivateNote.find({ connectRequest: connectRequestId, author: userId })
        .select("title content updatedAt createdAt author connectRequest")
        .sort({ updatedAt: -1 })
        .lean();

const findNoteById = (noteId) =>
    PrivateNote.findById(noteId);

const deleteNoteById = (noteId) =>
    PrivateNote.findByIdAndDelete(noteId);

module.exports = {
    findSessionParticipants,
    createNote,
    findNotesByUser,
    findNoteById,
    deleteNoteById,
};