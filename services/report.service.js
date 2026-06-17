
const {
    sendReportSubmittedEmail,
    sendReportResolvedEmail,
} = require("../utils/emails");
const repo = require("../repositories/report.repository");
const { uploadToCloudinary } = require("../utils/cloudinaryUpload");

const logger = require("../utils/logger");
const VALID_STATUSES = new Set(["open", "under_review", "resolved", "dismissed"]);

const submitReport = async ({ connectRequestId, complaintType, description, reportedById, file, user }) => {
    if (!connectRequestId || !complaintType || !description) {
        return { status: 400, body: { message: "connectRequestId, complaintType, and description are required" } };
    }

    if (description.trim().length < 10) {
        return { status: 400, body: { message: "Description must be at least 10 characters" } };
    }

    const connect = await repo.findConnectRequestById(connectRequestId);
    if (!connect) {
        return { status: 404, body: { message: "Connect request not found" } };
    }

    const isMentee = connect.mentee.toString() === reportedById.toString();
    const isMentor = connect.mentor.toString() === reportedById.toString();

    if (!isMentee && !isMentor) {
        return { status: 403, body: { message: "You are not part of this connect request" } };
    }

    const reporterRole = isMentee ? "mentee" : "mentor";
    const reportedUserId = isMentee ? connect.mentor : connect.mentee;

    const existing = await repo.findExistingReport(connectRequestId, reportedById);
    if (existing) {
        return { status: 409, body: { message: "You have already submitted a report for this session" } };
    }

    let screenshotUrl = "";
    let screenshotPublicId = "";

    if (file) {
        const uploaded = await uploadToCloudinary(file.buffer, file.mimetype);
        screenshotUrl = uploaded.secure_url;
        screenshotPublicId = uploaded.public_id;
    }

    const report = await repo.createReport({
        connectRequest: connectRequestId,
        reportedBy: reportedById,
        reportedUser: reportedUserId,
        reporterRole,
        complaintType,
        description: description.trim(),
        screenshotUrl,
        screenshotPublicId,
    });

    // ── Send report submitted email (non-blocking) ──
    sendReportSubmittedEmail({
        reporterName: user.name,
        reporterEmail: user.email,
        complaintType,
        description: description.trim(),
        reporterRole,
    }).catch((err) => logger.error("❌ sendReportSubmittedEmail failed:", err.message));

    return {
        status: 201,
        body: {
            success: true,
            message: "Report submitted successfully. Our team will review it shortly",
            report,
        },
    };
};

const getMyReport = async ({ connectRequestId, userId }) => {
    const report = await repo.findReportByConnectAndUser(connectRequestId, userId);
    return { status: 200, body: { report: report || null } };
};

const getAllReports = async ({ status, page = 1, limit = 20 }) => {
    const filter = {};
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await repo.countReports(filter);

    const reports = await repo.findReports(filter, { skip, limit: Number(limit) });

    return {
        status: 200,
        body: {
            reports,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        },
    };
};

const updateReportStatus = async ({ reportId, status, adminNote, userId }) => {
    if (!VALID_STATUSES.has(status)) {
        return { status: 400, body: { message: "Invalid status value" } };
    }

    const update = { status };
    if (adminNote !== undefined) update.adminNote = adminNote.trim();
    if (status === "resolved" || status === "dismissed") {
        update.resolvedAt = new Date();
        update.resolvedBy = userId;
    }

    const report = await repo.findReportByIdAndUpdate(reportId, update);
    if (!report) {
        return { status: 404, body: { message: "Report not found" } };
    }

    // ── Send resolved/dismissed email only on terminal statuses (non-blocking) ──
    if (status === "resolved" || status === "dismissed") {
        sendReportResolvedEmail({
            reporterName: report.reportedBy.name,
            reporterEmail: report.reportedBy.email,
            complaintType: report.complaintType,
            status,
            adminNote: adminNote?.trim() || "",
        }).catch((err) => logger.error("❌ sendReportResolvedEmail failed:", err.message));
    }

    return { status: 200, body: { success: true, report } };
};

module.exports = {
    submitReport,
    getMyReport,
    getAllReports,
    updateReportStatus,
};