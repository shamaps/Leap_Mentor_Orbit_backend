// backend/middleware/noteAccess.js
const ConnectRequest = require("../models/ConnectRequest");
const Note           = require("../models/Note");

/**
 * MIDDLEWARE 1 — validateSessionMembership
 * Confirms the requesting user is a participant of the session.
 * Attaches req.connectRequest and req.sessionRole to the request.
 */
const validateSessionMembership = async (req, res, next) => {
  try {
    const connectRequestId =
      req.params.connectRequestId || req.body.connectRequestId;

    if (!connectRequestId) {
      return res.status(400).json({
        message: "connectRequestId is required",
        code: "MISSING_SESSION_ID",
      });
    }

    const session = await ConnectRequest.findById(connectRequestId)
      .select("mentor mentee status")
      .lean();

    if (!session) {
      return res.status(404).json({
        message: "Session not found",
        code: "SESSION_NOT_FOUND",
      });
    }

    if (!["ongoing", "completed"].includes(session.status)) {
      return res.status(403).json({
        message: "Session is not active",
        code: "SESSION_INACTIVE",
      });
    }

    const uid      = req.user._id.toString();
    const isMentor = session.mentor.toString() === uid;
    const isMentee = session.mentee.toString() === uid;

    if (!isMentor && !isMentee) {
      return res.status(403).json({
        message: "You are not a participant of this session",
        code: "NOT_A_PARTICIPANT",
      });
    }

    // ✅ Attach to request for downstream use
    req.connectRequest = session;
    req.sessionRole    = isMentor ? "mentor" : "mentee";

    next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * MIDDLEWARE 2 — validateNoteOwnership
 * Confirms the requesting user is the author of the specific note.
 * Attaches req.note to the request.
 * Returns 404 (not 403) to conceal note existence from non-authors.
 */
const validateNoteOwnership = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id).lean();

    if (!note) {
      return res.status(404).json({
        message: "Note not found",
        code: "NOTE_NOT_FOUND",
      });
    }

    if (note.uploadedBy.toString() !== req.user._id.toString()) {
      // ✅ Return 404 instead of 403 to conceal note existence from non-authors
      return res.status(404).json({
        message: "Note not found",
        code: "NOTE_NOT_FOUND",
      });
    }

    // ✅ Attach note to request to avoid double DB call in controller
    req.note = note;

    next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * MIDDLEWARE 3 — requirePrivateOwnership
 * For list endpoints — injects a filter scoped to the requesting user.
 * Controller uses req.privateFilter instead of constructing its own.
 * Runs after validateSessionMembership so req.connectRequest is available.
 */
const requirePrivateOwnership = (req, res, next) => {
  // ✅ Use req.connectRequest._id from previous middleware — always available
  const connectRequestId =
    req.params.connectRequestId ||
    req.body.connectRequestId ||
    req.connectRequest?._id;

  req.privateFilter = {
    connectRequest: connectRequestId,
    uploadedBy:     req.user._id,
  };
  next();
};

module.exports = {
  validateSessionMembership,
  validateNoteOwnership,
  requirePrivateOwnership,
};