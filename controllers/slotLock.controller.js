const slotLockService = require("../services/slotLock.service");
const { handleError } = require("../utils/appError");
const logger = require("../utils/logger");
const { ok } = require("../utils/response");
// ─────────────────────────────────────────────────────────────
// POST /api/slot-locks/lock
// Called when mentee selects a slot in the UI
// ─────────────────────────────────────────────────────────────
const lockSlot = async (req, res) => {
  try {
    const { mentorId, date, startTime, endTime } = req.body;
    const { body } = await slotLockService.lockSlot({
      mentorId,
      date,
      startTime,
      endTime,
      menteeId: req.user._id,
    });
    return ok(res, body);
  } catch (err) {
    return handleError(res, err, "slotLock.lockSlot");
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/slot-locks/lock
// Called when mentee deselects a slot
// ─────────────────────────────────────────────────────────────
const unlockSlot = async (req, res) => {
  try {
    const { mentorId, date, startTime, endTime } = req.body;
    const { body } = await slotLockService.unlockSlot({
      mentorId,
      date,
      startTime,
      endTime,
      menteeId: req.user._id,
    });
    return ok(res, body);
  } catch (err) {
    return handleError(res, err, "slotLock.unlockSlot");
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/slot-locks/locks
// Called when mentee closes modal or cancels
// ─────────────────────────────────────────────────────────────
const unlockAllByMentee = async (req, res) => {
  try {
    const { mentorId } = req.body;
    const { body } = await slotLockService.unlockAllByMentee({
      mentorId,
      menteeId: req.user._id,
    });
    return ok(res, body);
  } catch (err) {
    return handleError(res, err, "slotLock.unlockAllByMentee");
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/slot-locks/:mentorId
// Returns active locks for a mentor (excluding requester's own)
// ─────────────────────────────────────────────────────────────
const getActiveLocks = async (req, res) => {
  try {
    const { body } = await slotLockService.getActiveLocks({
      mentorId: req.params.mentorId,
      userId: req.user._id,
    });
    return ok(res, body);
  } catch (err) {
    return handleError(res, err, "slotLock.getActiveLocks");
  }
};

module.exports = {
  lockSlot,
  unlockSlot,
  unlockAllByMentee,
  getActiveLocks,
};