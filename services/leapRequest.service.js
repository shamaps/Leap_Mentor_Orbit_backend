// services/leapRequest.service.js
const leapRequestRepo = require("../repositories/leapRequest.repository");
const { LEAP_REFILL_THRESHOLD, LEAP_REFILL_AMOUNT } = require("../config/constants");

const logger = require("../utils/logger");
// ── MENTEE: Check my latest request ──────────────────────────
const getMyRequest = async (menteeId) => {
    const request = await leapRequestRepo.findPendingByMentee(menteeId);

    if (!request) {
        const err = new Error("No pending request");
        err.statusCode = 404;
        throw err;
    }

    return request;
};

// ── MENTEE: Create a new request ─────────────────────────────
const createRequest = async (menteeId) => {
    const existing = await leapRequestRepo.findPendingByMenteeOne(menteeId);
    if (existing) {
        const err = new Error("A pending request already exists.");
        err.statusCode = 400;
        throw err;
    }

    // Fetch current wallet balance to snapshot it
    const wallet = await leapRequestRepo.findWalletByUser(menteeId);
    const currentBalance = wallet?.balance ?? 0;

    // Only allow if balance is below threshold
    if (currentBalance >= LEAP_REFILL_THRESHOLD) {
        const err = new Error("You still have Leap Points remaining.");
        err.statusCode = 400;
        throw err;
    }

    const request = await leapRequestRepo.createRequest({ mentee: menteeId, currentBalance });

    return { message: "Request submitted successfully.", request };
};

// ── ADMIN: Get all requests ───────────────────────────────────
const getAllRequests = async () => {
    const requests = await leapRequestRepo.findAllRequests();
    return { requests };
};

// ── ADMIN: Get pending count (for sidebar badge) ──────────────
const getPendingCount = async () => {
    const count = await leapRequestRepo.countPendingRequests();
    return { count };
};

// ── ADMIN: Approve — add 500 LP ──────────────────────────────
const approveRequest = async (id, adminId) => {
    const request = await leapRequestRepo.findRequestById(id);
    if (!request) {
        const err = new Error("Request not found");
        err.statusCode = 404;
        throw err;
    }
    if (request.status !== "pending") {
        const err = new Error("Request already processed");
        err.statusCode = 400;
        throw err;
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

// ── ADMIN: Reject ─────────────────────────────────────────────
const rejectRequest = async (id, adminId) => {
    const request = await leapRequestRepo.findRequestById(id);
    if (!request) {
        const err = new Error("Request not found");
        err.statusCode = 404;
        throw err;
    }
    if (request.status !== "pending") {
        const err = new Error("Request already processed");
        err.statusCode = 400;
        throw err;
    }

    request.status = "rejected";
    request.reviewedAt = new Date();
    request.reviewedBy = adminId;
    await request.save();

    return { message: "Request rejected.", request };
};

module.exports = {
    getMyRequest,
    createRequest,
    getAllRequests,
    getPendingCount,
    approveRequest,
    rejectRequest,
};