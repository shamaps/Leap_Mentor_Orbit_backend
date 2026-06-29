// controllers/slotLock.controller.js
const { handleError } = require("../utils/appError");
const { ok } = require("../utils/response");

/**
 * @typedef {Object} SlotLockService
 * @property {(params: Object) => Promise<{ status: number, body: Object }>} lockSlot - Core business handler placing transient timeline scheduling holds.
 * @property {(context: Object) => Promise<{ status: number, body: Object }>} unlockSlot - Core business handler clearing explicit individual locks.
 * @property {(purgeContext: Object) => Promise<{ status: number, body: Object }>} unlockAllByMentee - Core business handler releasing entire user lock holdings.
 * @property {(options: Object) => Promise<{ status: number, body: Object }>} getActiveLocks - Core business handler compiling opposing competitor segments lists.
 */

/**
 * Factory assembling presentation controllers layer handling HTTP timeline slot-locking orchestration parameters.
 * * @param {SlotLockService} slotLockService - Core operational scheduler worker service orchestration layer instance.
 * @param {{ logger: Object }} dependencies - Metric tracking and application logging telemetry tool.
 * @returns {Object} Grouped controller routes callback actions container mapping blueprint.
 */
const createSlotLockController = (slotLockService, { logger }) => {
  // POST /api/slot-locks/lock

  /**
   * Express Route Handler receiving dynamic body fields to write a transient calendar appointment hold.
   * * @async
   * @function lockSlot
   * @param {import('express').Request & { user: { _id: any } }} req - Input request message context framework containing parameters body criteria.
   * @param {import('express').Response} res - Standard outbound data response transport connector pipeline socket channel.
   */
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


  // DELETE /api/slot-locks/lock

  /**
   * Express Route Handler parsing request bodies to clear an existing explicit single selection lock.
   * * @async
   * @function unlockSlot
   * @param {import('express').Request & { user: { _id: any } }} req - Route context request envelope containing path qualifiers parameter parameters.
   * @param {import('express').Response} res - Structural payload interface output return connector transport pipeline.
   */
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


  // DELETE /api/slot-locks/locks

  /**
   * Express Route Handler executing mass drop cancelation pathways releasing entire active lock sets owned by a mentee.
   * * @async
   * @function unlockAllByMentee
   * @param {import('express').Request & { user: { _id: any } }} req - Dynamic framework input request context holding body configuration targets.
   * @param {import('express').Response} res - Dispatched success payload interface transport adapter pipeline closure.
   */
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


  // GET /api/slot-locks/:mentorId

  /**
   * Express Route Handler parsing path fields to extract current third-party competitor locks mapped onto a mentor's schedule.
   * * @async
   * @function getActiveLocks
   * @param {import('express').Request & { user: { _id: any } }} req - Operational framework parameters mapping dynamic variables query.
   * @param {import('express').Response} res - Data structural transformation execution interface socket pipeline.
   */
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

  return { lockSlot, unlockSlot, unlockAllByMentee, getActiveLocks };
};

module.exports = createSlotLockController;