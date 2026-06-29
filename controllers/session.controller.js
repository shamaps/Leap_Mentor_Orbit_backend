// controllers/session.controller.js
const AppError = require("../utils/appError");
const { handleError } = require("../utils/appError");
const { ok, created } = require("../utils/response");

/**
 * @typedef {Object} SessionServiceFacade
 * @property {(connectRequestId: string, userId: any) => Promise<Object>} getSlots
 * @property {(params: Object) => Promise<Object>} setMeetingLink
 * @property {(connectRequestId: string, slotIndex: string, userId: any) => Promise<Object>} markSlotComplete
 * @property {(connectRequestId: string, slotData: Object, userId: any) => Promise<Object>} addSlot
 * @property {(params: Object) => Promise<Object>} cancelSlot
 * @property {(params: Object) => Promise<Object>} rescheduleSlot
 * @property {(connectRequestId: string, userId: any, duration: number) => Promise<Object>} getMentorAvailability
 */

/**
 * Factory assembling presentation controller handlers processing appointment slots orchestration for HTTP routing.
 * * @param {SessionServiceFacade} sessionService - Unified facade instance wrapping underlying slot mutation and completion services.
 * @param {{ logger: Logger }} dependencies - Application performance metric capture monitoring tool.
 * @returns {Object} Grouped controller routes callback actions container mapping blueprint.
 */
const createSessionController = (sessionService, { logger }) => {
  // GET /api/sessions/:connectRequestId/slots

  /**
   * Express Route Handler reading session token components to return a full breakdown of schedule slots.
   * * @async
   * @function getSlots
   * @param {import('express').Request} req - Inbound network processing block context envelope containing path params.
   * @param {import('express').Response} res - Standard outbound data response transport connector pipeline socket.
   */
  const getSlots = async (req, res) => {
    try {
      const data = await sessionService.getSlots(
        req.params.connectRequestId,
        req.user._id
      );
      logger.info("getSlots completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "session.getSlots");
    }
  };


  // PATCH /api/sessions/:connectRequestId/slots/:slotIndex/meeting-link

  /**
   * Express Route Handler parsing text targets to apply or refresh link variables across active slots.
   * * @async
   * @function setMeetingLink
   * @param {import('express').Request} req - Interaction request frame context tracking path indicators and link strings.
   * @param {import('express').Response} res - Dispatched success payload interface transport adapter pipeline.
   */
  const setMeetingLink = async (req, res) => {
    try {
      const data = await sessionService.setMeetingLink({  // ← was positional, now object
        connectRequestId: req.params.connectRequestId,
        slotIndex: req.params.slotIndex,
        meetingLink: req.body.meetingLink,
        userId: req.user._id,
      });
      logger.info("setMeetingLink completed successfully");
      return ok(res, { message: "Meeting link updated", ...data });
    } catch (err) {
      return handleError(res, err, "session.setMeetingLink");
    }
  };


  // PATCH /api/sessions/:connectRequestId/slots/:slotIndex/mark-complete

  /**
   * Express Route Handler executing milestone settlement confirmations, locking in ledger adjustments on fulfillment.
   * * @async
   * @function markSlotComplete
   * @param {import('express').Request} req - Operational environment request parsing query constraints and identity keys.
   * @param {import('express').Response} res - Transmission response pipeline adapter.
   */
  const markSlotComplete = async (req, res) => {
    try {
      const data = await sessionService.markSlotComplete(
        req.params.connectRequestId,
        req.params.slotIndex,
        req.user._id
      );
      logger.info("markSlotComplete completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "session.markSlotComplete");
    }
  };


  // POST /api/sessions/:connectRequestId/add-slot

  /**
   * Express Route Handler appending a fresh programmatic slot node underneath an active relationship.
   * * @async
   * @function addSlot
   * @param {import('express').Request} req - Dynamic input request context framework containing body parameter entries.
   * @param {import('express').Response} res - Execution transport return link interface adapter socket pipeline.
   */
  const addSlot = async (req, res) => {
    try {
      const data = await sessionService.addSlot(
        req.params.connectRequestId,
        req.body,
        req.user._id
      );
      logger.info("addSlot completed successfully");
      return created(res, {
        message: "Additional session slot added successfully",
        ...data,
      });
    } catch (err) {
      return handleError(res, err, "session.addSlot");
    }
  };


  // PATCH /api/sessions/:connectRequestId/slots/:slotIndex/cancel

  /**
   * Express Route Handler executing cancellation workflows over a specified schedule index.
   * * @async
   * @function cancelSlot
   * @param {import('express').Request} req - Input target identification framework tracking specific path selectors.
   * @param {import('express').Response} res - Operational output return interface transport socket pipeline.
   */
  const cancelSlot = async (req, res) => {
    try {
      const data = await sessionService.cancelSlot({  // ← was positional, now object
        connectRequestId: req.params.connectRequestId,
        slotIndex: req.params.slotIndex,
        userId: req.user._id,
        reason: req.body.reason,
      });
      logger.info("cancelSlot completed successfully");
      return ok(res, { message: "Slot cancelled successfully", ...data });
    } catch (err) {
      return handleError(res, err, "session.cancelSlot");
    }
  };


  // PATCH /api/sessions/:connectRequestId/slots/:slotIndex/reschedule

  /**
   * Express Route Handler modifying parameters to overwrite time and hour structures inside an existing slot.
   * * @async
   * @function rescheduleSlot
   * @param {import('express').Request} req - Inbound transaction request envelope mapping path parameters and delta specifications.
   * @param {import('express').Response} res - Structural payload interface output return connector.
   */
  const rescheduleSlot = async (req, res) => {
    try {
      const data = await sessionService.rescheduleSlot({  // ← was positional, now object
        connectRequestId: req.params.connectRequestId,
        slotIndex: req.params.slotIndex,
        body: req.body,
        userId: req.user._id,
      });
      logger.info("rescheduleSlot completed successfully");
      return ok(res, { message: "Slot rescheduled successfully", ...data });
    } catch (err) {
      return handleError(res, err, "session.rescheduleSlot");
    }
  };


  // GET /api/sessions/:connectRequestId/mentor-availability

  /**
   * Express Route Handler resolving unblocked timeline configurations from host providers to identify available appointment segments.
   * * @async
   * @function getMentorAvailability
   * @param {import('express').Request} req - Inbound network context frame tracking parameters query parameters.
   * @param {import('express').Response} res - Data structural transformation returning connector socket.
   */
  const getMentorAvailability = async (req, res) => {
    try {
      const duration = Number.parseInt(req.query.duration) || 60;
      const data = await sessionService.getMentorAvailability(
        req.params.connectRequestId,
        req.user._id,
        duration
      );
      logger.info("getMentorAvailability completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "session.getMentorAvailability");
    }
  };

  return { getSlots, setMeetingLink, markSlotComplete, addSlot, cancelSlot, rescheduleSlot, getMentorAvailability };
};

module.exports = createSessionController;