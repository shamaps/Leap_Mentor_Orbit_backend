// backend/routes/slotLock.routes.js
const express = require("express");
const router  = express.Router();

const { authenticate } = require("../middleware/authenticate");
const { slotLockController } = require("../config/container");
const {
  lockSlot, unlockSlot, unlockAllByMentee, getActiveLocks,
} = slotLockController;

// Lock a slot (mentee selects a slot)
router.post("/lock", authenticate, lockSlot);

// Unlock a specific slot (mentee deselects a slot)
router.delete("/lock", authenticate, unlockSlot);        

// Unlock all locks by mentee (mentee closes modal)
router.delete("/locks", authenticate, unlockAllByMentee); // DELETE /locks (all locks)

// Get active locks for a mentor (used internally)
router.get("/:mentorId", authenticate, getActiveLocks);

module.exports = router;