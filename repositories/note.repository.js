// repositories/note.repository.js
const Note = require("../models/Note");
const ConnectRequest = require("../models/ConnectRequest");

// ─── ConnectRequest ──────────────────────────────────────────

const findSessionParticipants = (connectRequestId) =>
    ConnectRequest.findById(connectRequestId)
        .select("mentor mentee status")
        .lean();

// ─── Note ────────────────────────────────────────────────────

const createNote = (data) =>
    Note.create(data);

const findNoteByIdPopulated = (noteId) =>
    Note.findById(noteId).populate("uploadedBy", "name email").lean();

const findSharedNotes = (connectRequestId) =>
    Note.find({ connectRequest: connectRequestId, isPrivate: { $ne: true } })
        .populate("uploadedBy", "name email")
        .sort({ createdAt: -1 })
        .lean();

const findPrivateNotes = (connectRequestId, userId) =>
    Note.find({ connectRequest: connectRequestId, uploadedBy: userId, isPrivate: true })
        .populate("uploadedBy", "name email")
        .sort({ createdAt: -1 })
        .lean();

const findNoteById = (noteId) =>
    Note.findById(noteId);

const deleteNoteById = (noteId) =>
    Note.findByIdAndDelete(noteId);

module.exports = {
    findSessionParticipants,
    createNote,
    findNoteByIdPopulated,
    findSharedNotes,
    findPrivateNotes,
    findNoteById,
    deleteNoteById,
};