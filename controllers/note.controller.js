// controllers/note.controller.js
const noteService = require("../services/note.service");

const { logger } = require("@sentry/node");
const handleError = (res, err) =>
  res.status(err.statusCode || 500).json({ message: err.message });

// ─────────────────────────────────────────────────────────────
// POST /api/notes/upload
// ─────────────────────────────────────────────────────────────
const uploadNote = async (req, res) => {
  try {
    const data = await noteService.uploadNote(req.user._id, req.body, req.file);
    logger.info("uploadNote completed successfully");
    return res.status(201).json({ success: true, ...data });
  } catch (err) {
    logger.error("❌ uploadNote error:", err.message);
    if (err.message?.includes("File type not allowed")) {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large. Maximum size is 10MB." });
    }
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/notes/:connectRequestId
// ─────────────────────────────────────────────────────────────
const getNotes = async (req, res) => {
  try {
    const data = await noteService.getNotes(req.params.connectRequestId, req.user._id);
    logger.info("getNotes completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in note.controller", { error: err.message, stack: err.stack });
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/notes/:connectRequestId/private
// ─────────────────────────────────────────────────────────────
const getPrivateNotes = async (req, res) => {
  try {
    const data = await noteService.getPrivateNotes(req.params.connectRequestId, req.user._id);
    logger.info("getPrivateNotes completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in note.controller", { error: err.message, stack: err.stack });
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/notes/:id
// ─────────────────────────────────────────────────────────────
const deleteNote = async (req, res) => {
  try {
    const data = await noteService.deleteNote(req.params.id, req.user._id);
    logger.info("deleteNote completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in note.controller", { error: err.message, stack: err.stack });
    return handleError(res, err);
  }
};

module.exports = { uploadNote, getNotes, getPrivateNotes, deleteNote };