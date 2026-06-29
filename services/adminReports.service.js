// backend/services/adminReports.service.js
const { sendReportResolvedEmail } = require("../utils/emails");
const AppError = require("../utils/appError");

/**
 * Creates the admin reports service.
 * @param {Object} repo - The admin reports repository.
 * @param {Object} options - Service options.
 * @param {Object} options.logger - Logger instance.
 * @param {Function} options.createNotification - Function to create an in-app notification.
 * @returns {Object} Service methods.
 */
const createAdminReportsService = (repo, { logger, createNotification }) => {

    /**
     * Appends an admin note suffix if one exists.
     * Extracted to avoid nested template literals.
     * @param {string} [adminNote] - Optional note from the admin.
     * @returns {string} Formatted note string or empty string.
     */
    const notesSuffix = (adminNote) =>
        adminNote ? ` Note: ${adminNote}` : "";

    /**
     * Builds the in-app notification title and message for handleReport.
     * Extracted to fix: "Extract nested ternary" and "nested template literals".
     * @param {string} status - The new report status ('resolved' or 'dismissed').
     * @param {string} otherPerson - Name of the reported user.
     * @param {string} [adminNote] - Optional note from the admin.
     * @returns {{title: string, message: string}} The notification payload.
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

    // STATS

    /**
     * Fetches aggregate statistics for reports (total, pending, resolved today).
     * @returns {Promise<{totalReports: number, pendingResolution: number, resolvedToday: number}>}
     */
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

    // LIST

    /**
     * Fetches a paginated list of reports, optionally filtered by status and search terms.
     * @param {Object} params - Query parameters.
     * @param {number} params.page - Current page.
     * @param {number} params.limit - Number of items per page.
     * @param {string} [params.search] - Search term for user names.
     * @param {string} [params.status] - Report status filter.
     * @returns {Promise<{reports: Array<Object>, pagination: Object}>}
     */
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

    // HANDLE (resolve / dismiss)

    /**
     * Resolves or dismisses a report and sends appropriate notifications.
     * @param {Object} params - Action parameters.
     * @param {string} params.reportId - The ID of the report.
     * @param {string} params.status - 'resolved' or 'dismissed'.
     * @param {string} [params.adminNote] - Optional admin context.
     * @param {string} params.adminId - ID of the admin making the change.
     * @returns {Promise<Object>} Updated report data.
     * @throws {AppError} If report is not found.
     */
    const handleReport = async ({ reportId, status, adminNote, adminId }) => {
        const report = await repo.findReportById(reportId);
        if (!report) throw new AppError(404, "Report not found");

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
                logger.warn("sendReportResolvedEmail failed", { error: err.message })
            );
        }

        return {
            id: report._id,
            status: report.status,
            adminNote: report.adminNote,
            resolvedAt: report.resolvedAt,
        };
    };

    // PROCESS REFUND

    /**
     * Processes a refund for a mentee if a valid refund report is approved.
     * @param {Object} params - Refund parameters.
     * @param {string} params.reportId - The ID of the report.
     * @param {string} [params.adminNote] - Optional admin note.
     * @param {string} params.adminId - ID of the resolving admin.
     * @returns {Promise<{refundAmount: number}>} Details of the refunded amount.
     * @throws {AppError} 400/403/404 for invalid states.
     */
    const processRefund = async ({ reportId, adminNote, adminId }) => {
        const report = await repo.findReportByIdWithSession(reportId);
        if (!report) throw new AppError(404, "Report not found.");

        if (report.reporterRole !== "mentee") {
            throw new AppError(403, "Only mentees can request refunds. Mentors do not make payments");
        }
        if (report.complaintType !== "refund") {
            throw new AppError(400, "This report is not a refund request");
        }
        if (report.refundProcessed) {
            throw new AppError(400, "Refund already processed");
        }

        const connectRequest = report.connectRequest;
        if (!connectRequest) throw new AppError(404, "Session not found");
        if (connectRequest.paymentStatus !== "paid") {
            throw new AppError(400, "Session has not been paid — nothing to refund");
        }

        const menteeId = connectRequest.mentee;
        const totalAmount = connectRequest.totalAmount || 0;

        const menteeWallet = await repo.findMenteeWallet(menteeId);
        if (!menteeWallet) throw new AppError(404, "Mentee wallet not found");

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

        const resolvedAdminNote = adminNote?.trim() || "Refund processed by admin";

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
                logger.warn("sendReportResolvedEmail (refund) failed", { error: err.message })
            );
        }

        return { refundAmount };
    };

    // DELETE SESSION

    /**
     * Forcibly deletes a session connected to a report and notifies participants.
     * @param {Object} params - Delete parameters.
     * @param {string} params.reportId - The report ID associated with the session.
     * @param {string} [params.adminNote] - Optional admin explanation.
     * @param {string} params.adminId - ID of the resolving admin.
     * @returns {Promise<void>}
     * @throws {AppError} If report or session is not found.
     */
    const deleteSession = async ({ reportId, adminNote, adminId }) => {
        const report = await repo.findReportByIdWithSessionAndParticipants(reportId);
        if (!report) throw new AppError(404, "Report not found");

        const connectRequest = report.connectRequest;
        if (!connectRequest) {
            throw new AppError(404, "Session not found or already deleted");
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
                logger.warn("sendReportResolvedEmail (deleteSession) failed", { error: err.message })
            );
        }
    };

    return { fetchReportStats, fetchReports, handleReport, processRefund, deleteSession };
};
module.exports = createAdminReportsService;