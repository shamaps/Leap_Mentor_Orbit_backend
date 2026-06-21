// backend/routes/slotLock.routes.js
const express = require("express");
const router = express.Router();

const { authenticate, requireRole } = require("../middleware/authenticate");
const { slotLockController } = require("../config/container");
const {
  lockSlot, unlockSlot, unlockAllByMentee, getActiveLocks,
} = slotLockController;

// Lock a slot (mentee selects a slot during booking)
router.post("/lock", authenticate, requireRole("mentee"), lockSlot);

// Unlock a specific slot (mentee deselects a slot)
router.delete("/lock", authenticate, requireRole("mentee"), unlockSlot);

// Unlock all locks by mentee (mentee closes booking modal)
router.delete("/locks", authenticate, requireRole("mentee"), unlockAllByMentee);

// Get active locks for a mentor (used internally by mentor's availability view)
router.get("/:mentorId", authenticate, requireRole("mentor", "mentee"), getActiveLocks);

module.exports = router;