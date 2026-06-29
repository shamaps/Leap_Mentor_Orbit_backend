// controllers/note.controller.js
const AppError = require("../utils/appError");
const { handleError } = require("../utils/appError");
const { ok, created, fail, noContent } = require("../utils/response");

/**
 * @typedef {Object} NoteService
 * @property {(userId: any, body: Object, file: Object) => Promise<Object>} uploadNote - Triggers allocation paths checking size thresholds.
 * @property {(connectRequestId: string, userId: any) => Promise<Object>} getNotes - Collects public shared attachment indices.
 * @property {(connectRequestId: string, userId: any) => Promise<Object>} getPrivateNotes - Collects restricted individual metadata rows.
 * @property {(noteId: string, userId: any) => Promise<{message: string}>} deleteNote - Purges assets and clears tracking entries.
 */

/**
 * Factory assembling presentation controllers to route attachment requests over HTTP loops.
 * * @param {NoteService} noteService - Core metadata management service layer worker instance.
 * @param {{ logger: Object }} dependencies - Metric tracking and application logging telemetry tool.
 * @returns {Object} Grouped controller endpoints route callback actions map container.
 */
const createNoteController = (noteService, { logger }) => {
  // POST /api/notes/upload

  /**
   * Express Route Handler receiving dynamic payload fields and multi-part data chunks to write a note record.
   * Catches internal file limit constraint exceptions, substituting uniform floor errors.
   * * @async
   * @function uploadNote
   * @param {import('express').Request & { file: Object }} req - Intake framework request parsing body attributes and files.
   * @param {import('express').Response} res - Standard outbound data response transport connector pipeline socket.
   */
  const uploadNote = async (req, res) => {
    try {
      const data = await noteService.uploadNote(req.user._id, req.body, req.file);
      logger.info("uploadNote completed successfully");
      return created(res, data);
    } catch (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return fail(res, "File too large. Maximum size is 10MB.", 400);
      }
      return handleError(res, err, "note.uploadNote");
    }
  };


  // GET /api/notes/:connectRequestId

  /**
   * Express Route Handler parsing route variables to list all public files within session channels.
   * * @async
   * @function getNotes
   * @param {import('express').Request} req - Route context state parameter request containing tracking path components.
   * @param {import('express').Response} res - Dispatched output data interface component transport adapter pipeline socket.
   */
  const getNotes = async (req, res) => {
    try {
      const data = await noteService.getNotes(req.params.connectRequestId, req.user._id);
      logger.info("getNotes completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "note.getNotes");
    }
  };


  // GET /api/notes/:connectRequestId/private

  /**
   * Express Route Handler extracting private attachment metrics owned exclusively by the active credentials.
   * * @async
   * @function getPrivateNotes
   * @param {import('express').Request} req - Inbound transaction request envelope containing path qualifiers query parameters.
   * @param {import('express').Response} res - Structural data payload interface output transport channel.
   */
  const getPrivateNotes = async (req, res) => {
    try {
      const data = await noteService.getPrivateNotes(req.params.connectRequestId, req.user._id);
      logger.info("getPrivateNotes completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "note.getPrivateNotes");
    }
  };


  // DELETE /api/notes/:id

  /**
   * Express Route Handler initiating removal workflows over targeted attachment nodes.
   * * @async
   * @function deleteNote
   * @param {import('express').Request} req - Input target identification framework tracking specific path metrics.
   * @param {import('express').Response} res - Direct termination method transport interface closure.
   */
  const deleteNote = async (req, res) => {
    try {
      await noteService.deleteNote(req.params.id, req.user._id);
      logger.info("deleteNote completed successfully");
      return noContent(res);
    } catch (err) {
      return handleError(res, err, "note.deleteNote");
    }
  };
  return { uploadNote, getNotes, getPrivateNotes, deleteNote };
};
module.exports = createNoteController;