// controllers/connectRequest.controller.js

/**
 * Factory that creates the ConnectRequest controller.
 * Wires HTTP request/response handling to the service layer.
 *
 * @param {Object} service - ConnectRequest service instance
 * @param {Object} deps - Injected dependencies
 * @param {import('../utils/logger')} deps.logger - Winston logger instance
 * @returns {{
 *   sendConnectRequest: import('express').RequestHandler,
 *   getMyRequests:      import('express').RequestHandler,
 *   getIncomingRequests: import('express').RequestHandler,
 *   respondToRequest:   import('express').RequestHandler,
 *   cancelRequest:      import('express').RequestHandler,
 *   referRequest:       import('express').RequestHandler,
 *   getOngoingConnects: import('express').RequestHandler,
 *   getConnectDetail:   import('express').RequestHandler,
 * }}
 */
const { handleError } = require("../utils/appError");
const { ok, created, fail, noContent } = require("../utils/response");
const createConnectRequestController = (service, { logger }) => {
  /**
   * POST /connect-requests
   * Mentee sends a new connect request to a mentor.
   *
   * @type {import('express').RequestHandler}
   * @param {import('express').Request}  req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   *
   * @body {string}   mentorId       - ID of the mentor to request
   * @body {string}   [message]      - Optional message from the mentee
   * @body {Array}    selectedSlots  - 1–5 proposed time slots
   * @body {number}   [sessionRate]  - Optional rate per session
   * @body {number}   [sessionCount] - Optional number of sessions
   *
   * @returns {201} Created — `{ message, request }`
   * @returns {409} Conflict — duplicate request already exists
   */
  const sendConnectRequest = async (req, res, next) => {
    try {
      const { mentorId, message, selectedSlots, sessionRate, sessionCount } = req.body;

      const request = await service.sendRequest({
        mentorId,
        menteeId: req.user._id,
        menteeName: req.user.name,
        message,
        selectedSlots,
        sessionRate,
        sessionCount,
      });

      logger.info("Connect request sent", {
        menteeId: req.user._id.toString(),
        mentorId,
        requestId: request._id.toString(),
        slotCount: selectedSlots?.length,
      });

      logger.info("sendConnectRequest completed successfully");
      return created(res, { message: "Connect request sent successfully", request });
    } catch (err) {
      if (err.code === 11000) {
        logger.warn("Duplicate connect request attempt", {
          menteeId: req.user._id.toString(),
          mentorId: req.body.mentorId,
        });
        return fail(res, "You already have a pending request with this mentor", 409);
      }
      return handleError(res, err, "connectRequest.sendConnectRequest");
    }
  };

  /**
   * GET /connect-requests/my
   * Returns all connect requests sent by the authenticated mentee.
   *
   * @type {import('express').RequestHandler}
   * @param {import('express').Request}  req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   *
   * @returns {200} OK — `{ requests: ConnectRequestSummary[] }`
   */
  const getMyRequests = async (req, res, next) => {
    try {
      const requests = await service.getMyRequests(req.user._id);
      logger.info("getMyRequests completed successfully");
      return ok(res, { requests });
    } catch (err) {
      return handleError(res, err, "connectRequest.getMyRequests");
    }
  };

  /**
   * GET /connect-requests/incoming
   * Returns all connect requests received by the authenticated mentor,
   * optionally filtered by status via `?status=<value>`.
   *
   * @type {import('express').RequestHandler}
   * @param {import('express').Request}  req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   *
   * @query {string} [status] - Filter by request status (e.g. "pending", "accepted")
   *
   * @returns {200} OK — `{ requests: ConnectRequestSummary[] }`
   */
  const getIncomingRequests = async (req, res, next) => {
    try {
      const requests = await service.getIncomingRequests(req.user._id, req.query.status);
      logger.info("getIncomingRequests completed successfully");
      return ok(res, { requests });
    } catch (err) {
      return handleError(res, err, "connectRequest.getIncomingRequests");
    }
  };

  /**
   * PATCH /connect-requests/:id/respond
   * Mentor accepts or rejects a pending connect request.
   * When accepting, a `confirmedSlot` must be provided.
   *
   * @type {import('express').RequestHandler}
   * @param {import('express').Request}  req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   *
   * @param {string} req.params.id       - ConnectRequest document ID
   * @body  {string} status              - "accepted" | "rejected"
   * @body  {Object} [confirmedSlot]     - Required when status is "accepted"
   * @body  {string} confirmedSlot.date
   * @body  {string} confirmedSlot.startTime
   * @body  {string} confirmedSlot.endTime
   *
   * @returns {200} OK — `{ message, request }`
   * @returns {400} Bad Request — invalid status or missing confirmedSlot
   * @returns {403} Forbidden — caller is not the mentor on this request
   * @returns {404} Not Found — request does not exist
   */
  const respondToRequest = async (req, res, next) => {
    try {
      const { status, confirmedSlot } = req.body;

      const request = await service.respondToRequest({   // ← wrap in object
        requestId: req.params.id,
        mentorUserId: req.user._id,
        status,
        confirmedSlot,
      });

      logger.info("Connect request responded", {
        mentorId: req.user._id.toString(),
        requestId: req.params.id,
        status,
        confirmedSlot: confirmedSlot?.date,
      });

      logger.info("respondToRequest completed successfully");
      return ok(res, { message: `Request ${status} successfully`, request });
    } catch (err) {
      return handleError(res, err, "connectRequest.respondToRequest");
    }
  };

  /**
   * DELETE /connect-requests/:id
   * Mentee cancels (hard-deletes) their own connect request.
   * Ongoing sessions cannot be cancelled through this endpoint.
   *
   * @type {import('express').RequestHandler}
   * @param {import('express').Request}  req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   *
   * @param {string} req.params.id - ConnectRequest document ID
   *
   * @returns {204} No Content — request deleted
   * @returns {400} Bad Request — request is in "ongoing" state
   * @returns {403} Forbidden — caller is not the mentee on this request
   * @returns {404} Not Found — request does not exist
   */
  const cancelRequest = async (req, res, next) => {
    try {
      await service.cancelRequest(req.params.id, req.user._id);

      logger.info("Connect request cancelled", {
        menteeId: req.user._id.toString(),
        requestId: req.params.id,
      });

      return noContent(res);
    } catch (err) {
      return handleError(res, err, "connectRequest.cancelRequest");
    }
  };

  /**
   * POST /connect-requests/:id/refer
   * Mentor refers a pending request to a different mentor.
   * Creates a new ConnectRequest for the target mentor and
   * marks the original as "referred".
   *
   * @type {import('express').RequestHandler}
   * @param {import('express').Request}  req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   *
   * @param {string} req.params.id              - Original ConnectRequest document ID
   * @body  {string} referToMentorId            - User ID of the mentor to refer to
   *
   * @returns {200} OK — `{ message, originalRequest, newRequest }`
   * @returns {400} Bad Request — missing referToMentorId, self-referral, or request not pending
   * @returns {403} Forbidden — caller is not the mentor on the original request
   * @returns {404} Not Found — request does not exist
   * @returns {409} Conflict — mentee already has a pending request with the target mentor
   */
  const referRequest = async (req, res, next) => {
    try {
      const { originalRequest, newRequest } = await service.referRequest(
        req.params.id,
        req.user._id,
        req.body.referToMentorId
      );

      logger.info("Connect request referred", {
        mentorId: req.user._id.toString(),
        requestId: req.params.id,
        referToMentorId: req.body.referToMentorId,
        newRequestId: newRequest._id.toString(),
      });

      logger.info("referRequest completed successfully");
      return ok(res, { message: "Request referred successfully", originalRequest, newRequest });
    } catch (err) {
      return handleError(res, err, "connectRequest.referRequest");
    }
  };

  /**
   * GET /connect-requests/ongoing
   * Returns all active mentorship sessions for the authenticated user
   * (whether they are the mentor or the mentee).
   *
   * @type {import('express').RequestHandler}
   * @param {import('express').Request}  req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   *
   * @returns {200} OK — `{ connects: ConnectRequestSummary[] }`
   */
  const getOngoingConnects = async (req, res, next) => {
    try {
      const connects = await service.getOngoingConnects(req.user._id);
      logger.info("getOngoingConnects completed successfully");
      return ok(res, { connects });
    } catch (err) {
      return handleError(res, err, "connectRequest.getOngoingConnects");
    }
  };

  /**
   * GET /connect-requests/:id
   * Returns full details of a single connect request.
   * The caller must be either the mentor or the mentee on the request.
   *
   * @type {import('express').RequestHandler}
   * @param {import('express').Request}  req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   *
   * @param {string} req.params.id - ConnectRequest document ID
   *
   * @returns {200} OK — `{ connect: ConnectRequestDetail }`
   * @returns {403} Forbidden — caller is neither mentor nor mentee on this request
   * @returns {404} Not Found — request does not exist
   */
  const getConnectDetail = async (req, res, next) => {
    try {
      const connect = await service.getConnectDetail(req.params.id, req.user._id);
      logger.info("getConnectDetail completed successfully");
      return ok(res, { connect });
    } catch (err) {
      return handleError(res, err, "connectRequest.getConnectDetail");
    }
  };

  return { sendConnectRequest, getMyRequests, getIncomingRequests, respondToRequest, cancelRequest, referRequest, getOngoingConnects, getConnectDetail };
};
module.exports = createConnectRequestController;