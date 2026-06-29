// repositories/privateNote.repository.js
const PrivateNote = require("../models/PrivateNote");
const ConnectRequest = require("../models/ConnectRequest");

// ─── ConnectRequest ──────────────────────────────────────────

/**
 * Queries ConnectRequest collections providing lean dictionary snapshots tracking session participants.
 * * @function findSessionParticipants
 * @param {string} connectRequestId - Target selection locator primary index key string.
 * @returns {Promise<Object|null>} Lean data record parameters context layout blueprint or null.
 */
const findSessionParticipants = (connectRequestId) =>
    ConnectRequest.findById(connectRequestId)
        .select("mentor mentee status")
        .lean();

// ─── PrivateNote ─────────────────────────────────────────────

/**
 * Commits a fresh private notebook entry data model configuration onto persistent database rows.
 * * @function createNote
 * @param {Object} data - Schema constraints verified configuration data properties container.
 * @returns {Promise<Object>} Freshly written database record model instance return.
 */
const createNote = (data) =>
    PrivateNote.create(data);

/**
 * Pulls a descending chronological list array containing all personal notes created by a specific user inside a session tunnel.
 * * @function findNotesByUser
 * @param {string} connectRequestId - Associated target session checking locator query parameter.
 * @param {any} userId - Reference checking index parameters isolating notebook rows ownership.
 * @returns {Promise<Object[]>} Arrays listing lean data notebook rows dictionaries.
 */
const findNotesByUser = (connectRequestId, userId) =>
    PrivateNote.find({ connectRequest: connectRequestId, author: userId })
        .select("title content updatedAt createdAt author connectRequest")
        .sort({ updatedAt: -1 })
        .lean();

/**
 * Selects an interactive private note document instance enabling structural logic processing.
 * * @function findNoteById
 * @param {string} noteId - Unique system row database identifier key string.
 * @returns {Promise<Object|null>} Full hydrated document template instance structure, or null.
 */
const findNoteById = (noteId) =>
    PrivateNote.findById(noteId);

/**
 * Hard deletes a progress node layout template physically from data collections.
 * * @function deleteNoteById
 * @param {string} noteId - Primary system lookup parameter index indicator string.
 * @returns {Promise<Object|null>} Operations summary return confirming database metrics details.
 */
const deleteNoteById = (noteId) =>
    PrivateNote.findByIdAndDelete(noteId);

module.exports = {
    findSessionParticipants,
    createNote,
    findNotesByUser,
    findNoteById,
    deleteNoteById,
};