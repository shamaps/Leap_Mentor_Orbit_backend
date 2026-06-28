// backend/routes/slotLock.routes.js
const express = require("express");
const router = express.Router();
const validate = require("../middleware/validate");
const { lockSlotSchema, unlockSlotSchema } = require("../validators/slotLock.validator");
const { authenticate, requireRole } = require("../middleware/authenticate");
const { slotLockController } = require("../config/container");
const {
  lockSlot, unlockSlot, unlockAllByMentee, getActiveLocks,
} = slotLockController;

/**
 * @openapi
 * /slot-locks/lock:
 *   post:
 *     tags: [SlotLock]
 *     summary: Lock a slot during the booking flow
 *     description: Mentee role only. Optimistic concurrency control to prevent double-booking while the mentee finalizes a request.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mentorId, date, startTime, endTime]
 *             properties:
 *               mentorId:
 *                 type: string
 *                 example: "665f1c2e4b1a2c001f8e9a22"
 *               date:
 *                 type: string
 *                 pattern: '^\d{4}-\d{2}-\d{2}$'
 *                 example: "2026-07-06"
 *               startTime:
 *                 type: string
 *                 pattern: '^\d{2}:\d{2}$'
 *                 example: "09:00"
 *               endTime:
 *                 type: string
 *                 pattern: '^\d{2}:\d{2}$'
 *                 example: "10:00"
 *     responses:
 *       200:
 *         description: Slot locked.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Validation failed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Not a mentee.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Slot is already locked by another user.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConflictResponse'
 */
// Lock a slot (mentee selects a slot during booking)
router.post("/lock", authenticate, requireRole("mentee"), validate(lockSlotSchema), lockSlot);

/**
 * @openapi
 * /slot-locks/lock:
 *   delete:
 *     tags: [SlotLock]
 *     summary: Unlock a specific slot
 *     description: Mentee role only. Used when a mentee deselects a slot.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mentorId, date, startTime, endTime]
 *             properties:
 *               mentorId:
 *                 type: string
 *               date:
 *                 type: string
 *                 pattern: '^\d{4}-\d{2}-\d{2}$'
 *               startTime:
 *                 type: string
 *                 pattern: '^\d{2}:\d{2}$'
 *               endTime:
 *                 type: string
 *                 pattern: '^\d{2}:\d{2}$'
 *     responses:
 *       200:
 *         description: Slot unlocked.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Validation failed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Not a mentee.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Unlock a specific slot (mentee deselects a slot)
router.delete("/lock", authenticate, requireRole("mentee"), validate(unlockSlotSchema), unlockSlot);

/**
 * @openapi
 * /slot-locks/locks:
 *   delete:
 *     tags: [SlotLock]
 *     summary: Unlock all slots locked by the logged-in mentee
 *     description: Used when a mentee closes the booking modal without confirming.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All locks released.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Not a mentee.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Unlock all locks by mentee (mentee closes booking modal)
router.delete("/locks", authenticate, requireRole("mentee"), unlockAllByMentee);

/**
 * @openapi
 * /slot-locks/{mentorId}:
 *   get:
 *     tags: [SlotLock]
 *     summary: Get active slot locks for a mentor
 *     description: Used internally by the mentor's availability view to show which slots are currently being booked by others.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: mentorId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of active locks.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Role not permitted.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Get active locks for a mentor (used internally by mentor's availability view)
router.get("/:mentorId", authenticate, requireRole("mentor", "mentee"), getActiveLocks);

module.exports = router;
