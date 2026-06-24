// services/leapRequest.service.js
const { LEAP_REFILL_THRESHOLD, LEAP_REFILL_AMOUNT } = require("../config/constants");
const AppError = require("../utils/appError")
const createLeapRequestService = (leapRequestRepo, { logger }) => {
    // MENTEE: Check my latest request 
    const getMyRequest = async (menteeId) => {
        const request = await leapRequestRepo.findPendingByMentee(menteeId);

        if (!request) {
            throw new AppError(404, "No pending request");
        }

        return request;
    };

    //  MENTEE: Create a new request
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

        return { message: "Request submitted successfully.", request };
    };

    // ADMIN: Get all requests 
    const getAllRequests = async ({ page = 1, limit = 50 } = {}) => {
        const safePage = Math.max(1, Number.parseInt(page) || 1);
        const safeLimit = Math.min(100, Number.parseInt(limit) || 50);
        const skip = (safePage - 1) * safeLimit;

        const [requests, total] = await Promise.all([
            leapRequestRepo.findAllRequests(skip, safeLimit),
            leapRequestRepo.countAllRequests(),
        ]);

        return {
            requests,
            pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) },
        };
    };

    // ADMIN: Get pending count (for sidebar badge)
    const getPendingCount = async () => {
        const count = await leapRequestRepo.countPendingRequests();
        return { count };
    };

    // ADMIN: Approve — add 500 LP 
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
            request,
        };
    };

    //  ADMIN: Reject
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

        return { message: "Request rejected.", request };
    };

    return { getMyRequest, createRequest, getAllRequests, getPendingCount, approveRequest, rejectRequest };
};
module.exports = createLeapRequestService;