// controllers/privateNote.controller.js
const privateNoteService = require("../services/privateNote.service");

const handleError = (res, err) =>
  res.status(err.statusCode || 500).json({ message: err.message });

// ─────────────────────────────────────────────────────────────
// POST /api/private-notes
// ─────────────────────────────────────────────────────────────
const createNote = async (req, res) => {
  try {
    const data = await privateNoteService.createNote(req.user._id, req.body);
    return res.status(201).json({ success: true, ...data });
  } catch (err) {
    console.error("❌ createNote error:", err.message);
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/private-notes/:connectRequestId
// ─────────────────────────────────────────────────────────────
const getNotes = async (req, res) => {
  try {
    const data = await privateNoteService.getNotes(req.params.connectRequestId, req.user._id);
    return res.json({ success: true, ...data });
  } catch (err) {
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/private-notes/:id
// ─────────────────────────────────────────────────────────────
const updateNote = async (req, res) => {
  try {
    const data = await privateNoteService.updateNote(req.params.id, req.user._id, req.body);
    return res.json({ success: true, ...data });
  } catch (err) {
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/private-notes/:id
// ─────────────────────────────────────────────────────────────
const deleteNote = async (req, res) => {
  try {
    const data = await privateNoteService.deleteNote(req.params.id, req.user._id);
    return res.json({ success: true, ...data });
  } catch (err) {
    return handleError(res, err);
  }
};

module.exports = { createNote, getNotes, updateNote, deleteNote };