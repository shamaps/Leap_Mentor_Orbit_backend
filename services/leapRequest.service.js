// services/leapRequest.service.js

/**
 * @fileoverview Business logic layer for LeapRequest.
 * Enforces refill eligibility rules, delegates persistence to the
 * repository, and shapes responses through the DTO mapper.
 *
 * @module services/leapRequest
 */

const { LEAP_REFILL_THRESHOLD, LEAP_REFILL_AMOUNT } = require("../config/constants");
const AppError = require("../utils/appError");
const { toLeapRequestDTO, toLeapRequestListDTO } = require("../utils/mappers/leapRequest.mapper");

/**
 * Factory that creates the LeapRequest service.
 *
 * @param {Object} leapRequestRepo - LeapRequest repository (data-access layer)
 * @param {Object} deps - Injected dependencies
 * @param {import('../utils/logger')} deps.logger - Winston logger instance
 * @returns {{
 *   getMyRequest:    Function,
 *   createRequest:   Function,
 *   getAllRequests:   Function,
 *   getPendingCount: Function,
 *   approveRequest:  Function,
 *   rejectRequest:   Function,
 * }}
 */
const createLeapRequestService = (leapRequestRepo, { logger }) => {

    /**
     * Returns the mentee's latest pending Leap Points request.
     *
     * @param {mongoose.Types.ObjectId|string} menteeId
     * @returns {Promise<Object>} LeapRequestDTO
     * @throws {AppError} 404 - No pending request found for this mentee
     */
    const getMyRequest = async (menteeId) => {
        const request = await leapRequestRepo.findPendingByMentee(menteeId);

        if (!request) {
            throw new AppError(404, "No pending request");
        }

        return toLeapRequestDTO(request);
    };

    /**
     * Submits a new Leap Points refill request for a mentee.
     *
     * Guards:
     * - Blocks if a pending request already exists.
     * - Blocks if the mentee's current wallet balance is at or above
     *   `LEAP_REFILL_THRESHOLD` (they still have points remaining).
     * - Snapshots the current balance at the time of request creation.
     *
     * @param {mongoose.Types.ObjectId|string} menteeId
     * @returns {Promise<{ message: string, request: Object }>}
     *   Confirmation message and the created LeapRequestDTO
     * @throws {AppError} 400 - Pending request already exists
     * @throws {AppError} 400 - Balance is at or above the refill threshold
     */
    const createRequest = async (menteeId) => {
        const existing = await leapRequestRepo.findPendingByMenteeOne(menteeId);
        if (existing) {
            throw new AppError(400, "A pending request already exists.");
        }

        // Fetch current wallet balance to snapshot it
        const wallet = await leapRequestRepo.findWalletByUser(menteeId);
        const currentBalance = wallet?.balance ?? 0;

        // Only allow if balance is below threshold
        if (currentBalance >= LEAP_REFILL_THRESHOLD) {
            throw new AppError(400, "You still have Leap Points remaining.");
        }

        const request = await leapRequestRepo.createRequest({ mentee: menteeId, currentBalance });

        return { message: "Request submitted successfully.", request: toLeapRequestDTO(request) };
    };

    /**
     * Returns a paginated list of all Leap Points requests (admin view).
     * Page and limit values are clamped to safe ranges
     * (page ≥ 1, limit between 1 and 100).
     *
     * @param {Object} [options={}]
     * @param {number|string} [options.page=1]   - 1-indexed page number
     * @param {number|string} [options.limit=50] - Items per page (max 100)
     * @returns {Promise<Object>} `{ requests: LeapRequestDTO[], pagination: { page, limit, total, pages } }`
     */
    const getAllRequests = async ({ page = 1, limit = 50 } = {}) => {
        const safePage = Math.max(1, Number.parseInt(page) || 1);
        const safeLimit = Math.min(100, Number.parseInt(limit) || 50);
        const skip = (safePage - 1) * safeLimit;

        const [requests, total] = await Promise.all([
            leapRequestRepo.findAllRequests(skip, safeLimit),
            leapRequestRepo.countAllRequests(),
        ]);

        const pagination = { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) };

        return toLeapRequestListDTO({ requests, pagination });
    };

    /**
     * Returns the total number of pending Leap Points requests.
     * Used to populate the admin sidebar badge.
     *
     * @returns {Promise<{ count: number }>}
     */
    const getPendingCount = async () => {
        const count = await leapRequestRepo.countPendingRequests();
        return { count };
    };

    /**
     * Approves a pending Leap Points request and credits the mentee's wallet
     * with `LEAP_REFILL_AMOUNT` LP via an atomic `$inc` update (upsert-safe).
     *
     * @param {string} id      - LeapRequest document ID
     * @param {mongoose.Types.ObjectId|string} adminId - ID of the approving admin
     * @returns {Promise<{ message: string, newBalance: number, request: Object }>}
     *   Confirmation message, updated wallet balance, and the approved LeapRequestDTO
     * @throws {AppError} 404 - Request not found
     * @throws {AppError} 400 - Request has already been processed (status !== "pending")
     */
    const approveRequest = async (id, adminId) => {
        const request = await leapRequestRepo.findRequestById(id);
        if (!request) {
            throw new AppError(404, "Request not found");
        }
        if (request.status !== "pending") {
            throw new AppError(400, "Request already processed");
        }

        // Add refill amount LP to the mentee's wallet
        const wallet = await leapRequestRepo.incrementWalletBalance(request.mentee, LEAP_REFILL_AMOUNT);

        request.status = "approved";
        request.reviewedAt = new Date();
        request.reviewedBy = adminId;
        await request.save();

        return {
            message: `${LEAP_REFILL_AMOUNT} LP added successfully`,
            newBalance: wallet.balance,
            request: toLeapRequestDTO(request),
        };
    };

    /**
     * Rejects a pending Leap Points request.
     * No wallet changes are made; only the request status is updated.
     *
     * @param {string} id      - LeapRequest document ID
     * @param {mongoose.Types.ObjectId|string} adminId - ID of the rejecting admin
     * @returns {Promise<{ message: string, request: Object }>}
     *   Confirmation message and the rejected LeapRequestDTO
     * @throws {AppError} 404 - Request not found
     * @throws {AppError} 400 - Request has already been processed (status !== "pending")
     */
    const rejectRequest = async (id, adminId) => {
        const request = await leapRequestRepo.findRequestById(id);
        if (!request) {
            throw new AppError(404, "Request not found");
        }
        if (request.status !== "pending") {
            throw new AppError(400, "Request already processed");
        }

        request.status = "rejected";
        request.reviewedAt = new Date();
        request.reviewedBy = adminId;
        await request.save();

        return { message: "Request rejected.", request: toLeapRequestDTO(request) };
    };

    return { getMyRequest, createRequest, getAllRequests, getPendingCount, approveRequest, rejectRequest };
};
module.exports = createLeapRequestService;