// repositories/invoice.repository.js
const ConnectRequest = require("../models/ConnectRequest");
const AdminUser = require("../models/AdminUser");

/**
 * Find a connect request by ID with mentee + mentor populated.
 * * @async
 * @function findConnectRequestById
 * @param {string} connectRequestId - Target selection locator primary index key string.
 * @returns {Promise<Object|null>} Populated plain JavaScript document snapshot representation data, or null.
 */
const findConnectRequestById = async (connectRequestId) => {
    return await ConnectRequest.findById(connectRequestId)
        .populate("mentee", "name email")
        .populate("mentor", "name email")
        .lean();
};

/**
 * Find the active admin user and return only commissionRate.
 * * @async
 * @function findActiveAdminCommissionRate
 * @returns {Promise<Object|null>} Dehydrated un-instanced admin document mapping parameters or null.
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