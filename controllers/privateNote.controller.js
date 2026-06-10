// controllers/privateNote.controller.js
const privateNoteService = require("../services/privateNote.service");
const { logger } = require("@sentry/node");
const AppError = require("../utils/AppError");
const { handleError } = require("../utils/AppError");
// ─────────────────────────────────────────────────────────────
// POST /api/private-notes
// ─────────────────────────────────────────────────────────────
const createNote = async (req, res) => {
  try {
    const data = await privateNoteService.createNote(req.user._id, req.body);
    logger.info("createNote completed successfully");
    return res.status(201).json({ success: true, ...data });
  } catch (err) {
    logger.error("❌ createNote error:", err.message);
    return handleError(res, err, "privateNote.createNote");
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/private-notes/:connectRequestId
// ─────────────────────────────────────────────────────────────
const getNotes = async (req, res) => {
  try {
    const data = await privateNoteService.getNotes(req.params.connectRequestId, req.user._id);
    logger.info("getNotes completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in privateNote.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "privateNote.getNotes");
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/private-notes/:id
// ─────────────────────────────────────────────────────────────
const updateNote = async (req, res) => {
  try {
    const data = await privateNoteService.updateNote(req.params.id, req.user._id, req.body);
    logger.info("updateNote completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in privateNote.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "privateNote.updateNote");
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/private-notes/:id
// ─────────────────────────────────────────────────────────────
const deleteNote = async (req, res) => {
  try {
    await privateNoteService.deleteNote(req.params.id, req.user._id);
    logger.info("deleteNote completed successfully");
    return res.status(204).send();
  } catch (err) {
    logger.error("Unhandled error in privateNote.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "privateNote.deleteNote");
  }
};

module.exports = { createNote, getNotes, updateNote, deleteNote };