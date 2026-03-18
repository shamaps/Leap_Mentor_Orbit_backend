// backend/controllers/privateNote.controller.js
const PrivateNote    = require("../models/PrivateNote");
const ConnectRequest = require("../models/ConnectRequest");

// ── Helper: confirm user is a session participant ──────────────
const validateSessionAccess = async (connectRequestId, userId) => {
  const request = await ConnectRequest.findById(connectRequestId)
    .select("mentor mentee status")
    .lean();
  if (!request) {
    return { valid: false, reason: "Session not found", status: 404 };
  }
  if (!["ongoing", "completed"].includes(request.status)) {
    return { valid: false, reason: "Session is not active", status: 400 };
  }
  const uid = userId.toString();
  if (request.mentor.toString() !== uid && request.mentee.toString() !== uid) {
    return { valid: false, reason: "Not authorized", status: 403 };
  }
  return { valid: true };
};

// ─────────────────────────────────────────────────────────────
// POST /api/private-notes
// Create a new private note
// ─────────────────────────────────────────────────────────────
const createNote = async (req, res) => {
  try {
    const { connectRequestId, title, content } = req.body;
    const userId = req.user._id;

    if (!connectRequestId) {
      return res.status(400).json({ message: "connectRequestId is required" });
    }

    const access = await validateSessionAccess(connectRequestId, userId);
    if (!access.valid) {
      return res.status(access.status).json({ message: access.reason });
    }

    const note = await PrivateNote.create({
      connectRequest: connectRequestId,
      author:         userId,
      title:          title?.trim() || "Untitled Note",
      content:        content || "",
    });

    return res.status(201).json({ success: true, note });
  } catch (err) {
    console.error("❌ createNote error:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/private-notes/:connectRequestId
// Get all private notes for this user in this session
// ─────────────────────────────────────────────────────────────
const getNotes = async (req, res) => {
  try {
    const { connectRequestId } = req.params;
    const userId = req.user._id;

    const access = await validateSessionAccess(connectRequestId, userId);
    if (!access.valid) {
      return res.status(access.status).json({ message: access.reason });
    }

    const notes = await PrivateNote.find({
      connectRequest: connectRequestId,
      author:         userId,
    })
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({ success: true, notes });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/private-notes/:id
// Update title or content of a note (author only)
// ─────────────────────────────────────────────────────────────
const updateNote = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const note   = await PrivateNote.findById(req.params.id);

    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    if (note.author.toString() !== userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (req.body.title   !== undefined) note.title   = req.body.title.trim() || "Untitled Note";
    if (req.body.content !== undefined) note.content = req.body.content;

    await note.save();
    return res.json({ success: true, note });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/private-notes/:id
// Delete a note (author only)
// ─────────────────────────────────────────────────────────────
const deleteNote = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const note   = await PrivateNote.findById(req.params.id);

    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    if (note.author.toString() !== userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await PrivateNote.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: "Note deleted" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { createNote, getNotes, updateNote, deleteNote };