// backend/middleware/noteAccess.js
const ConnectRequest = require("../models/ConnectRequest");
const Note           = require("../models/Note");
const Goal           = require("../models/Goal");
const Milestone      = require("../models/Milestone");
const logger = require("../utils/logger");
const { ACTIVE_SESSION_STATUSES } = require("../config/constants");
const { idToString } = require("../utils/idToString");
/**
 * MIDDLEWARE 1 — validateSessionMembership
 * Confirms the requesting user is a participant of the session.
 * Attaches req.connectRequest and req.sessionRole to the request.
 */
const validateSessionMembership = async (req, res, next) => {
  try {
    const connectRequestId =
      req.params.connectRequestId || req.body?.connectRequestId || req.resolvedConnectRequestId;
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

    const allowedStatuses = req.sessionAllowedStatuses || ACTIVE_SESSION_STATUSES;
    if (!allowedStatuses.includes(session.status)) {
      return res.status(403).json({
        message: "Session is not active",
        code: "SESSION_INACTIVE",
      });
    }

    const uid      = idToString(req.user._id);
    const isMentor = idToString(session.mentor) === uid;
    const isMentee = idToString(session.mentee) === uid;

    if (!isMentor && !isMentee) {
      return res.status(403).json({
        message: "You are not a participant of this session",
        code: "NOT_A_PARTICIPANT",
      });
    }

    // Attach to request for downstream use
    req.connectRequest = session;
    req.sessionRole    = isMentor ? "mentor" : "mentee";

    next();
  } catch (err) {
    logger.error("noteAccess.validateSessionMembership failed", {
      error: err.message,
      stack: err.stack,
      connectRequestId: req.params.connectRequestId || req.body?.connectRequestId || req.resolvedConnectRequestId,
      userId: req.user?._id,
    });
    return res.status(500).json({ message: err.message });
  }
};


/** Allows routes that operate on an accepted request to reuse the participant check. */
const allowAcceptedSession = (req, res, next) => {
  req.sessionAllowedStatuses = [...new Set(["accepted", ...ACTIVE_SESSION_STATUSES])];
  next();
};

/** Resolves goal and milestone paths to their owning connect request before membership validation. */
const resolveSessionFromResource = async (req, res, next) => {
  try {
    if (req.params.connectRequestId || req.body?.connectRequestId) return next();

    let resource = null;
    let resourceName = "Session resource";
    if (req.params.goalId) {
      resource = await Goal.findById(req.params.goalId).select("connectRequest").lean();
      resourceName = "Goal";
    } else if (req.params.milestoneId) {
      resource = await Milestone.findById(req.params.milestoneId).select("connectRequest").lean();
      resourceName = "Milestone";
    }

    if (!resource) {
      return res.status(404).json({ message: `${resourceName} not found` });
    }

    req.resolvedConnectRequestId = resource.connectRequest;
    return next();
  } catch (err) {
    logger.error("noteAccess.resolveSessionFromResource failed", {
      error: err.message,
      resourceId: req.params.goalId || req.params.milestoneId,
      userId: req.user?._id,
    });
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
    if (idToString(note.uploadedBy) !== idToString(req.user._id)) {
      // Return 404 instead of 403 to conceal note existence from non-authors
      return res.status(404).json({
        message: "Note not found",
        code: "NOTE_NOT_FOUND",
      });
    }

    // Attach note to request to avoid double DB call in controller
    req.note = note;

    next();
  } catch (err) {
      logger.error("noteAccess.validateNoteOwnership failed", {
        error: err.message,
        stack: err.stack,
        noteId: req.params.id,
        userId: req.user?._id,
      });
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
  // Use req.connectRequest._id from previous middleware — always available
  const connectRequestId =
    req.params.connectRequestId ||
    req.body?.connectRequestId ||
    req.connectRequest?._id;

  req.privateFilter = {
    connectRequest: connectRequestId,
    uploadedBy:     req.user._id,
  };
  next();
};

module.exports = {
  validateSessionMembership,
  allowAcceptedSession,
  resolveSessionFromResource,
  validateNoteOwnership,
  requirePrivateOwnership,
};