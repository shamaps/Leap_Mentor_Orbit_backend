// backend/services/adminReports.service.js
const repo = require("../repositories/adminReports.repository");
const createNotification = require("../utils/createNotification");
const { sendReportResolvedEmail } = require("../utils/sendNotificationEmail");
const AppError = require("../utils/AppError");

// ─────────────────────────────────────────────────────────────
// Pure helpers — fix nested ternaries + nested template literals
// ─────────────────────────────────────────────────────────────

/**
 * Appends an admin note suffix if one exists.
 * Extracted to avoid nested template literals.
 */
const notesSuffix = (adminNote) =>
    adminNote ? ` Note: ${adminNote}` : "";

/**
 * Builds the in-app notification title and message for handleReport.
 * Extracted to fix: "Extract nested ternary" and "nested template literals".
 */
const buildReportNotification = (status, otherPerson, adminNote) => {
    const suffix = notesSuffix(adminNote);

    if (status === "resolved") {
        return {
            title: "Your report has been resolved ✅",
            message: `Your complaint against ${otherPerson} has been resolved by our admin team.${suffix}`,
        };
    }

    return {
        title: "Your report has been reviewed",
        message: `Your complaint against ${otherPerson} was reviewed and dismissed.${suffix}`,
    };
};

// ─────────────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────────────

const fetchReportStats = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalReports, pendingResolution, resolvedToday] = await Promise.all([
        repo.countAllReports(),
        repo.countPendingReports(),
        repo.countResolvedToday(today),
    ]);

    return { totalReports, pendingResolution, resolvedToday };
};

// ─────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────

const fetchReports = async ({ page, limit, search, status }) => {
    const skip = (page - 1) * limit;
    const filter = {};

    if (status) filter.status = status;

    if (search) {
        const userIds = await repo.findUserIdsByName(search);
        filter.$or = [
            { reportedBy: { $in: userIds } },
            { reportedUser: { $in: userIds } },
        ];
    }

    const [totalCount, reports] = await Promise.all([
        repo.countReports(filter),
        repo.findReports(filter, skip, limit),
    ]);

    const rows = reports.map((r) => ({
        id: r._id,
        mentee: r.reporterRole === "mentee" ? r.reportedBy?.name : r.reportedUser?.name,
        menteeEmail: r.reporterRole === "mentee" ? r.reportedBy?.email : r.reportedUser?.email,
        mentor: r.reporterRole === "mentor" ? r.reportedBy?.name : r.reportedUser?.name,
        mentorEmail: r.reporterRole === "mentor" ? r.reportedBy?.email : r.reportedUser?.email,
        reportedBy: r.reportedBy?.name || "—",
        reportedById: r.reportedBy?._id || null,
        reportedUser: r.reportedUser?.name || "—",
        reporterRole: r.reporterRole,
        category: r.complaintType,
        description: r.description,
        screenshotUrl: r.screenshotUrl || "",
        adminNote: r.adminNote || "",
        status: r.status,
        refundProcessed: r.refundProcessed || false,
        connectRequestId: r.connectRequest?._id || null,
        sessionStatus: r.connectRequest?.status || null,
        paymentStatus: r.connectRequest?.paymentStatus || null,
        totalAmount: r.connectRequest?.totalAmount || 0,
        date: r.createdAt
            ? new Date(r.createdAt).toISOString().split("T")[0]
            : "—",
    }));

    return {
        reports: rows,
        pagination: {
            totalCount,
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            hasMore: page < Math.ceil(totalCount / limit),
        },
    };
};

// ─────────────────────────────────────────────────────────────
// HANDLE (resolve / dismiss)
// ─────────────────────────────────────────────────────────────

const handleReport = async (reportId, { status, adminNote }, adminId) => {
    const report = await repo.findReportById(reportId);
    if (!report) throw new AppError(404, "Report not found.");

    report.status = status;
    report.adminNote = adminNote?.trim() || report.adminNote;
    report.resolvedAt = new Date();
    report.resolvedBy = adminId;
    await repo.saveReport(report);

    // ── In-app notification ──
    const recipientId = report.reportedBy?._id;
    if (recipientId) {
        const otherPerson = report.reportedUser?.name || "the other user";
        // FIX: buildReportNotification() eliminates nested ternaries + nested template literals
        const { title, message } = buildReportNotification(status, otherPerson, adminNote?.trim());

        await createNotification({
            recipient: recipientId,
            type: "new_review",
            title,
            message,
            metadata: { requestId: report.connectRequest },
        });
    }

    // ── Email (non-blocking) ──
    if (report.reportedBy?.email) {
        sendReportResolvedEmail({
            reporterName: report.reportedBy.name,
            reporterEmail: report.reportedBy.email,
            complaintType: report.complaintType,
            status,
            adminNote: adminNote?.trim() || "",
            reporterRole: report.reporterRole,
        }).catch((err) =>
            console.error("❌ sendReportResolvedEmail failed:", err.message)
        );
    }

    return {
        id: report._id,
        status: report.status,
        adminNote: report.adminNote,
        resolvedAt: report.resolvedAt,
    };
};

// ─────────────────────────────────────────────────────────────
// PROCESS REFUND
// ─────────────────────────────────────────────────────────────

const processRefund = async (reportId, { adminNote }, adminId) => {
    const report = await repo.findReportByIdWithSession(reportId);
    if (!report) throw new AppError(404, "Report not found.");

    if (report.reporterRole !== "mentee") {
        throw new AppError(403, "Only mentees can request refunds. Mentors do not make payments.");
    }
    if (report.complaintType !== "refund") {
        throw new AppError(400, "This report is not a refund request.");
    }
    if (report.refundProcessed) {
        throw new AppError(400, "Refund already processed.");
    }

    const connectRequest = report.connectRequest;
    if (!connectRequest) throw new AppError(404, "Session not found.");
    if (connectRequest.paymentStatus !== "paid") {
        throw new AppError(400, "Session has not been paid — nothing to refund.");
    }

    const menteeId = connectRequest.mentee;
    const totalAmount = connectRequest.totalAmount || 0;

    const menteeWallet = await repo.findMenteeWallet(menteeId);
    if (!menteeWallet) throw new AppError(404, "Mentee wallet not found.");

    const refundAmount = Math.min(totalAmount, menteeWallet.escrow);
    menteeWallet.escrow = Math.max(0, menteeWallet.escrow - refundAmount);
    menteeWallet.balance += refundAmount;
    await repo.saveWallet(menteeWallet);

    await repo.createRefundTransaction({
        user: menteeId,
        type: "escrow_refund",
        amount: refundAmount,
        description: "Admin refund — report resolved",
        balanceAfter: menteeWallet.balance,
        connectRequest: connectRequest._id,
    });

    connectRequest.paymentStatus = "refunded";
    connectRequest.status = "rejected";
    await repo.saveConnectRequest(connectRequest);

    const resolvedAdminNote = adminNote?.trim() || "Refund processed by admin.";

    report.refundProcessed = true;
    report.refundedAt = new Date();
    report.status = "resolved";
    report.resolvedAt = new Date();
    report.resolvedBy = adminId;
    report.adminNote = resolvedAdminNote;
    await repo.saveReport(report);

    await createNotification({
        recipient: menteeId,
        type: "new_review",
        title: "Refund processed ✅",
        message: `Your refund of ${refundAmount} tokens has been returned to your wallet by the admin team.`,
        metadata: { requestId: connectRequest._id, amount: refundAmount },
    });

    // ── Email (non-blocking) ──
    if (report.reportedBy?.email) {
        sendReportResolvedEmail({
            reporterName: report.reportedBy.name,
            reporterEmail: report.reportedBy.email,
            complaintType: report.complaintType,
            status: "resolved",
            adminNote: resolvedAdminNote,
            reporterRole: report.reporterRole,
        }).catch((err) =>
            console.error("❌ sendReportResolvedEmail (refund) failed:", err.message)
        );
    }

    return { refundAmount };
};

// ─────────────────────────────────────────────────────────────
// DELETE SESSION
// ─────────────────────────────────────────────────────────────

const deleteSession = async (reportId, { adminNote }, adminId) => {
    const report = await repo.findReportByIdWithSessionAndParticipants(reportId);
    if (!report) throw new AppError(404, "Report not found.");

    const connectRequest = report.connectRequest;
    if (!connectRequest) {
        throw new AppError(404, "Session not found or already deleted.");
    }

    const menteeId = connectRequest.mentee?._id || connectRequest.mentee;
    const mentorId = connectRequest.mentor?._id || connectRequest.mentor;
    const menteeName = connectRequest.mentee?.name || "Mentee";
    const mentorName = connectRequest.mentor?.name || "Mentor";

    await repo.deleteConnectRequestById(connectRequest._id);

    if (menteeId) {
        await createNotification({
            recipient: menteeId,
            type: "new_review",
            title: "Session removed by admin",
            message: `Your session with ${mentorName} has been removed by the admin team following a report.`,
            metadata: { requestId: connectRequest._id },
        });
    }

    if (mentorId) {
        await createNotification({
            recipient: mentorId,
            type: "new_review",
            title: "Session removed by admin",
            message: `Your session with ${menteeName} has been removed by the admin team following a report.`,
            metadata: { requestId: connectRequest._id },
        });
    }

    const resolvedAdminNote = adminNote?.trim() || "Session deleted by admin.";

    report.adminNote = resolvedAdminNote;
    report.status = "resolved";
    report.resolvedAt = new Date();
    report.resolvedBy = adminId;
    await repo.saveReport(report);

    // ── Email (non-blocking) ──
    if (report.reportedBy?.email) {
        sendReportResolvedEmail({
            reporterName: report.reportedBy.name,
            reporterEmail: report.reportedBy.email,
            complaintType: report.complaintType,
            status: "resolved",
            adminNote: resolvedAdminNote,
            reporterRole: report.reporterRole,
        }).catch((err) =>
            console.error("❌ sendReportResolvedEmail (deleteSession) failed:", err.message)
        );
    }
};

module.exports = {
    fetchReportStats,
    fetchReports,
    handleReport,
    processRefund,
    deleteSession,
};