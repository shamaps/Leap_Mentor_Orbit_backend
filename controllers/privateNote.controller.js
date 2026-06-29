// controllers/privateNote.controller.js
const { handleError } = require("../utils/appError");
const { ok, created, noContent } = require("../utils/response");

/**
 * @typedef {Object} PrivateNoteService
 * @property {(userId: any, body: Object) => Promise<Object>} createNote - Services logic processing fresh personal notebook records entries.
 * @property {(connectRequestId: string, userId: any) => Promise<Object>} getNotes - Services logic collecting caller notebook arrays rows.
 * @property {(noteId: string, userId: any, body: Object) => Promise<Object>} updateNote - Services logic mutating fields entries data.
 * @property {(noteId: string, userId: any) => Promise<{message: string}>} deleteNote - Services logic deleting targeted notebook data nodes.
 */

/**
 * Factory assembling presentation controllers to handle HTTP notebook routing requests over express streams.
 * * @param {PrivateNoteService} privateNoteService - Core underlying personal notebook orchestration service instance.
 * @param {{ logger: Logger }} dependencies - Performance trace logger facility tracking runtime context metrics.
 * @returns {Object} Grouped controller routes callback actions mapping container.
 */
const createPrivateNoteController = (privateNoteService, { logger }) => {
  // POST /api/private-notes

  /**
   * Express Route Handler receiving text payload parameters to write a brand-new notebook node.
   * * @async
   * @function createNote
   * @param {import('express').Request} req - Intake framework request parsing body attributes parameters metrics.
   * @param {import('express').Response} res - Standard outbound communication connection wrapper pipeline transport.
   */
  const createNote = async (req, res) => {
    try {
      const data = await privateNoteService.createNote(req.user._id, req.body);
      logger.info("createNote completed successfully");
      return created(res, data);
    } catch (err) {
      return handleError(res, err, "privateNote.createNote");
    }
  };


  // GET /api/private-notes/:connectRequestId

  /**
   * Express Route Handler parsing route variables to pull notebook lists belonging specifically to the caller.
   * * @async
   * @function getNotes
   * @param {import('express').Request} req - Input request message envelope parsing token path parameters indices.
   * @param {import('express').Response} res - Standard connection output response transport pipe adapter pipeline.
   */
  const getNotes = async (req, res) => {
    try {
      const data = await privateNoteService.getNotes(req.params.connectRequestId, req.user._id);
      logger.info("getNotes completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "privateNote.getNotes");
    }
  };


  // PATCH /api/private-notes/:id

  /**
   * Express Route Handler parsing query parameters and text blocks to apply updates on a specific notebook entity.
   * * @async
   * @function updateNote
   * @param {import('express').Request} req - Route context parameter request object holding dynamic indices statements.
   * @param {import('express').Response} res - Structural payload interface output return connector adapter.
   */
  const updateNote = async (req, res) => {
    try {
      const data = await privateNoteService.updateNote(req.params.id, req.user._id, req.body);
      logger.info("updateNote completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "privateNote.updateNote");
    }
  };


  // DELETE /api/private-notes/:id

  /**
   * Express Route Handler initiating hard removal pathways over individual notebook files.
   * * @async
   * @function deleteNote
   * @param {import('express').Request} req - Input target identification framework tracking path pointer indicators.
   * @param {import('express').Response} res - Direct termination method transport interface closure adapter pipeline.
   */
  const deleteNote = async (req, res) => {
    try {
      await privateNoteService.deleteNote(req.params.id, req.user._id);
      logger.info("deleteNote completed successfully");
      return noContent(res);
    } catch (err) {
      return handleError(res, err, "privateNote.deleteNote");
    }
  };

  return { createNote, getNotes, updateNote, deleteNote };
};

module.exports = createPrivateNoteController;