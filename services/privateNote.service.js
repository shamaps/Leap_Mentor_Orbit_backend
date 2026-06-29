// services/privateNote.service.js
const { ACTIVE_SESSION_STATUSES } = require("../config/constants");
const { validateSessionAccess } = require("../utils/sessionAccess");
const AppError = require("../utils/appError");

/**
 * @typedef {Object} SessionParticipantsConfig
 * @property {any} mentor - Unique user identity tracker for the mentor.
 * @property {any} mentee - Unique user identity tracker for the mentee.
 * @property {string} status - Platform operational status label.
 */

/**
 * @typedef {Object} PrivateNoteRepository
 * @property {(connectRequestId: string) => Promise<SessionParticipantsConfig|null>} findSessionParticipants - Resolves participant indices.
 * @property {(data: Object) => Promise<Object>} createNote - Registers a fresh personal private note document.
 * @property {(connectRequestId: string, userId: any) => Promise<Object[]>} findNotesByUser - Pulls descending chronological list arrays.
 * @property {(noteId: string) => Promise<Object|null>} findNoteById - Resolves an interactive Mongoose document instance template.
 * @property {(noteId: string) => Promise<Object|null>} deleteNoteById - Hard discards record metadata from database collections.
 */

/**
 * Factory function implementing the core business logic layer for processing personalized session logs.
 * * @param {PrivateNoteRepository} privateNoteRepo - Data repository abstraction mapping layers.
 * @param {{ logger: Logger }} dependencies - Telemetry monitoring diagnostics tools.
 * @returns {Object} Operational service interface exposing private notebook methods.
 */
const createPrivateNoteService = (privateNoteRepo, { logger }) => {

    // POST /api/private-notes
    /**
     * Provisions a private text canvas entry bounded under an active relationship validation block.
     * * @async
     * @function createNote
     * @param {any} userId - Secure user identifier signature key checking ownership from request tokens.
     * @param {Object} body - Intake parameters payload package data.
     * @param {string} body.connectRequestId - Associated unique target platform session channel index.
     * @param {string} [body.title] - Custom title label text falling back to "Untitled Note".
     * @param {string} [body.content] - Core text block string parameters recording details.
     * @throws {AppError} 400 - If parent unique index parameter fields evaluate missing.
     * @throws {AppError} 403 - If token indices fail partnership validation boundaries.
     * @returns {Promise<{ note: Object }>} Freshly instantiated written database record model instance.
     */
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
    /**
     * Resolves personal notebook nodes created specifically by the active user inside a dynamic session channel.
     * * @async
     * @function getNotes
     * @param {string} connectRequestId - Dialogue pipeline lookup index key string.
     * @param {any} userId - Secure parsing verification validation signature key tracking active permissions.
     * @throws {AppError} 403 - If session tokens fail relationship checks.
     * @returns {Promise<{ notes: Object[] }>} Collection array tracking private document entries.
     */
    const getNotes = async (connectRequestId, userId) => {
        const access = await validateSessionAccess(privateNoteRepo.findSessionParticipants, connectRequestId, userId);
        if (!access.valid) {
            throw new AppError(access.status, access.reason);
        }

        const notes = await privateNoteRepo.findNotesByUser(connectRequestId, userId);
        return { notes };
    };


    // PATCH /api/private-notes/:id
    /**
     * Inplaces modifications over selective properties of an in-progress private log item.
     * * @async
     * @function updateNote
     * @param {string} noteId - Primary database entry unique lookup index key.
     * @param {any} userId - Target modifier criteria reference index pointer.
     * @param {Object} body - Delta properties criteria configuration container data payload.
     * @param {string} [body.title] - Replacement text labeling title parameters.
     * @param {string} [body.content] - Replacement core body textual description parameters.
     * @throws {AppError} 403 - If identity indicators reveal a mismatch against uploader fields.
     * @throws {AppError} 404 - If lookups resolve no matching structural database records.
     * @returns {Promise<{ note: Object }>} Freshly mutated note record model entity properties.
     */
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
    /**
     * Hard erases a personal progress node element record completely using specific indicators.
     * * @async
     * @function deleteNote
     * @param {string} noteId - Target primary database unique lookup locator string key.
     * @param {any} userId - Execution context credentials verification indicator pointer checking ownership.
     * @throws {AppError} 403 - If dynamic tokens fail relationship boundaries checks.
     * @throws {AppError} 404 - If database query targets reveal unresolvable items.
     * @returns {Promise<{ message: string }>} Basic structural success text confirmation response.
     */
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