// repositories/invoice.repository.js
const ConnectRequest = require("../models/ConnectRequest");
const AdminUser = require("../models/AdminUser");

/**
 * Find a connect request by ID with mentee + mentor populated.
 * @param {string} connectRequestId
 * @returns {Promise<Object|null>}
 */
const findConnectRequestById = async (connectRequestId) => {
    return await ConnectRequest.findById(connectRequestId)
        .populate("mentee", "name email")
        .populate("mentor", "name email")
        .lean();
};

/**
 * Find the active admin user and return only commissionRate.
 * @returns {Promise<Object|null>}
 */
const findActiveAdminCommissionRate = async () => {
    return await AdminUser.findOne({ isActive: true })
        .select("commissionRate")
        .lean();
};

module.exports = {
    findConnectRequestById,
    findActiveAdminCommissionRate,
};