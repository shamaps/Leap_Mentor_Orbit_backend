// controllers/leapRequest.controller.js

/**
 * @fileoverview HTTP layer for LeapRequest.
 * Delegates all business logic to the service; handles only
 * request parsing, response formatting, and error forwarding.
 *
 * @module controllers/leapRequest
 */

const { handleError } = require("../utils/appError");
const { ok, created } = require("../utils/response");

/**
 * Factory that creates the LeapRequest controller.
 *
 * @param {Object} leapRequestService - LeapRequest service instance
 * @param {Object} deps - Injected dependencies
 * @param {import('../utils/logger')} deps.logger - Winston logger instance
 * @returns {{
 *   getMyRequest:    import('express').RequestHandler,
 *   createRequest:   import('express').RequestHandler,
 *   getAllRequests:   import('express').RequestHandler,
 *   getPendingCount: import('express').RequestHandler,
 *   approveRequest:  import('express').RequestHandler,
 *   rejectRequest:   import('express').RequestHandler,
 * }}
 */
const createLeapRequestController = (leapRequestService, { logger }) => {

  /**
   * GET /leap-requests/my
   * Mentee retrieves their own latest pending Leap Points request.
   *
   * @type {import('express').RequestHandler}
   * @param {import('express').Request}  req - `req.user._id` identifies the mentee
   * @param {import('express').Response} res
   *
   * @returns {200} OK — LeapRequestDTO for the pending request
   * @returns {404} Not Found — no pending request exists for this mentee
   */
  const getMyRequest = async (req, res) => {
    try {
      const data = await leapRequestService.getMyRequest(req.user._id);
      logger.info("getMyRequest completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "leapRequest.getMyRequest");
    }
  };

  /**
   * POST /leap-requests
   * Mentee submits a new Leap Points refill request.
   * Blocked if a pending request already exists or the mentee's
   * current balance is at or above the refill threshold.
   *
   * @type {import('express').RequestHandler}
   * @param {import('express').Request}  req - `req.user._id` identifies the mentee
   * @param {import('express').Response} res
   *
   * @returns {201} Created — `{ message, request: LeapRequestDTO }`
   * @returns {400} Bad Request — pending request already exists, or balance above threshold
   */
  const createRequest = async (req, res) => {
    try {
      const data = await leapRequestService.createRequest(req.user._id);
      logger.info("createRequest completed successfully");
      return created(res, data);
    } catch (err) {
      return handleError(res, err, "leapRequest.createRequest");
    }
  };

  /**
   * GET /leap-requests (admin)
   * Returns a paginated list of all Leap Points requests across all mentees.
   *
   * @type {import('express').RequestHandler}
   * @param {import('express').Request}  req
   * @param {import('express').Response} res
   *
   * @query {number} [page=1]   - Page number (1-indexed)
   * @query {number} [limit=50] - Items per page (max 100)
   *
   * @returns {200} OK — `{ requests: LeapRequestDTO[], pagination }`
   */
  const getAllRequests = async (req, res) => {
    try {
      const data = await leapRequestService.getAllRequests({
        page: req.query.page,
        limit: req.query.limit,
      });
      logger.info("getAllRequests completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "leapRequest.getAllRequests");
    }
  };

  /**
   * GET /leap-requests/pending-count (admin)
   * Returns the total number of pending Leap Points requests.
   * Used to populate the sidebar badge in the admin dashboard.
   *
   * @type {import('express').RequestHandler}
   * @param {import('express').Request}  req
   * @param {import('express').Response} res
   *
   * @returns {200} OK — `{ count: number }`
   */
  const getPendingCount = async (req, res) => {
    try {
      const data = await leapRequestService.getPendingCount();
      logger.info("getPendingCount completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "leapRequest.getPendingCount");
    }
  };

  /**
   * PATCH /leap-requests/:id/approve (admin)
   * Approves a pending request and credits the mentee's wallet
   * with the configured refill amount (LEAP_REFILL_AMOUNT LP).
   *
   * @type {import('express').RequestHandler}
   * @param {import('express').Request}  req
   * @param {import('express').Response} res
   *
   * @param {string} req.params.id  - LeapRequest document ID
   * @param {Object} req.admin      - Authenticated admin (set by auth middleware)
   *
   * @returns {200} OK — `{ message, newBalance, request: LeapRequestDTO }`
   * @returns {400} Bad Request — request has already been processed
   * @returns {404} Not Found — request does not exist
   */
  const approveRequest = async (req, res) => {
    try {
      const data = await leapRequestService.approveRequest(req.params.id, req.admin?._id);
      logger.info("approveRequest completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "leapRequest.approveRequest");
    }
  };

  /**
   * PATCH /leap-requests/:id/reject (admin)
   * Rejects a pending Leap Points request. No wallet changes are made.
   *
   * @type {import('express').RequestHandler}
   * @param {import('express').Request}  req
   * @param {import('express').Response} res
   *
   * @param {string} req.params.id  - LeapRequest document ID
   * @param {Object} req.admin      - Authenticated admin (set by auth middleware)
   *
   * @returns {200} OK — `{ message, request: LeapRequestDTO }`
   * @returns {400} Bad Request — request has already been processed
   * @returns {404} Not Found — request does not exist
   */
  const rejectRequest = async (req, res) => {
    try {
      const data = await leapRequestService.rejectRequest(req.params.id, req.admin?._id);
      logger.info("rejectRequest completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "leapRequest.rejectRequest");
    }
  };

  return { getMyRequest, createRequest, getAllRequests, getPendingCount, approveRequest, rejectRequest };
};
module.exports = createLeapRequestController;