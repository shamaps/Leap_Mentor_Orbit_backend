// controllers/privateNote.controller.js
const privateNoteService = require("../services/privateNote.service");

const { logger } = require("@sentry/node");
const handleError = (res, err) =>
  res.status(err.statusCode || 500).json({ message: err.message });

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
    return handleError(res, err);
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
    return handleError(res, err);
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
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/private-notes/:id
// ─────────────────────────────────────────────────────────────
const deleteNote = async (req, res) => {
  try {
    const data = await privateNoteService.deleteNote(req.params.id, req.user._id);
    logger.info("deleteNote completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in privateNote.controller", { error: err.message, stack: err.stack });
    return handleError(res, err);
  }
};

module.exports = { createNote, getNotes, updateNote, deleteNote };