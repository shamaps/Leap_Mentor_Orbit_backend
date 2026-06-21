const Report = require("../models/Report");
const ConnectRequest = require("../models/ConnectRequest");

const findConnectRequestById = (id) =>
    ConnectRequest.findById(id).select("mentee mentor").lean();

const findExistingReport = (connectRequestId, reportedById) =>
    Report.findOne({
        connectRequest: connectRequestId,
        reportedBy: reportedById,
    }).select("_id").lean();

const createReport = (data) => Report.create(data);

const findReportByConnectAndUser = (connectRequestId, userId) =>
    Report.findOne({
        connectRequest: connectRequestId,
        reportedBy: userId,
    }).lean();

const countReports = (filter) => Report.countDocuments(filter);

const findReports = (filter, { skip, limit }) =>
    Report.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("reportedBy", "name email")
        .populate("reportedUser", "name email")
        .populate("connectRequest", "status totalAmount")
        .lean();

const findReportByIdAndUpdate = (reportId, update) =>
    Report.findByIdAndUpdate(reportId, update, {
        new: true,
        runValidators: true,
    })
        .populate("reportedBy", "name email")
        .populate("reportedUser", "name email");

module.exports = {
    findConnectRequestById,
    findExistingReport,
    createReport,
    findReportByConnectAndUser,
    countReports,
    findReports,
    findReportByIdAndUpdate,
};