// repositories/note.repository.js
const Note = require("../models/Note");
const ConnectRequest = require("../models/ConnectRequest");

// ─── ConnectRequest ──────────────────────────────────────────

/**
 * Pulls summary information for a request, selecting participant indices for tracking permissions checks.
 * * @function findSessionParticipants
 * @param {string} connectRequestId - Target selection locator primary index key string.
 * @returns {Promise<Object|null>} Lean document representation context layout blueprint, or null.
 */
const findSessionParticipants = (connectRequestId) =>
    ConnectRequest.findById(connectRequestId)
        .select("mentor mentee status")
        .lean();

// ─── Note ────────────────────────────────────────────────────

/**
 * Creates and stores a fresh attachment document row mapping attributes.
 * * @function createNote
 * @param {Object} data - Schema constraints defined criteria configuration object.
 * @returns {Promise<Object>} Freshly written database record model instance return.
 */
const createNote = (data) =>
    Note.create(data);

/**
 * Returns a detailed note document populated with primary account creator profiles.
 * * @function findNoteByIdPopulated
 * @param {any} noteId - Target primary key tracking internal note entries.
 * @returns {Promise<Object|null>} Fully expanded lean document representation data map, or null.
 */
const findNoteByIdPopulated = (noteId) =>
    Note.findById(noteId).populate("uploadedBy", "name email").lean();

/**
 * Returns a descending sorted collection array containing all notes marked public inside a session channel.
 * * @function findSharedNotes
 * @param {string} connectRequestId - Targeted session checking locator query parameter.
 * @returns {Promise<Object[]>} Collection array of lean plain objects containing tracking attributes.
 */
const findSharedNotes = (connectRequestId) =>
    Note.find({ connectRequest: connectRequestId, isPrivate: { $ne: true } })
        .populate("uploadedBy", "name email")
        .sort({ createdAt: -1 })
        .lean();

/**
 * Filters out public items, returning private data node rows owned exclusively by the caller user.
 * * @function findPrivateNotes
 * @param {string} connectRequestId - Associated unique parent channel criteria search identifier.
 * @param {any} userId - Reference key indicator verifying owner parameters constraints.
 * @returns {Promise<Object[]>} Collection array describing isolated personal nodes.
 */
const findPrivateNotes = (connectRequestId, userId) =>
    Note.find({ connectRequest: connectRequestId, uploadedBy: userId, isPrivate: true })
        .populate("uploadedBy", "name email")
        .sort({ createdAt: -1 })
        .lean();

/**
 * Selects an interactive milestone subcomponent document enabling structural logic processing.
 * * @function findNoteById
 * @param {string} noteId - Unique system row database identifier key string.
 * @returns {Promise<Object|null>} Full hydrated document template instance structure, or null.
 */
const findNoteById = (noteId) =>
    Note.findById(noteId);

/**
 * Hard discards progress node structures using specific row targets.
 * * @function deleteNoteById
 * @param {string} noteId - Primary system lookup parameter index indicator string.
 * @returns {Promise<Object|null>} Operations summary return confirming database metrics details.
 */
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