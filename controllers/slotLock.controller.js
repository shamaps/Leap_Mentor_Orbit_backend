const slotLockService = require("../services/slotLock.service");
const { handleError } = require("../utils/AppError");
const logger = require("../utils/logger");
// ─────────────────────────────────────────────────────────────
// POST /api/slot-locks/lock
// Called when mentee selects a slot in the UI
// ─────────────────────────────────────────────────────────────
const lockSlot = async (req, res) => {
  try {
    const { mentorId, date, startTime, endTime } = req.body;
    const { status, body } = await slotLockService.lockSlot({
      mentorId,
      date,
      startTime,
      endTime,
      menteeId: req.user._id,
    });
    return res.status(status).json(body);
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
    const { status, body } = await slotLockService.unlockSlot({
      mentorId,
      date,
      startTime,
      endTime,
      menteeId: req.user._id,
    });
    return res.status(status).json(body);
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
    const { status, body } = await slotLockService.unlockAllByMentee({
      mentorId,
      menteeId: req.user._id,
    });
    return res.status(status).json(body);
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
    const { status, body } = await slotLockService.getActiveLocks({
      mentorId: req.params.mentorId,
      userId: req.user._id,
    });
    return res.status(status).json(body);
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