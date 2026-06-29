//report.service.js
const {
    sendReportSubmittedEmail,
    sendReportResolvedEmail,
} = require("../utils/emails");
const { signCloudinaryUrl } = require("../utils/cloudinarySign");
const { uploadToCloudinary } = require("../utils/cloudinaryUpload");
const { reportScreenshotId } = require("../utils/cloudinaryPublicId");

/**
 * @typedef {Object} ReportRepository
 * @property {(id: string) => Promise<Object|null>} findConnectRequestById - Resolves session participant structural config keys.
 * @property {(connectRequestId: string, reportedById: any) => Promise<Object|null>} findExistingReport - Checks for prior duplicate report holdings.
 * @property {(data: Object) => Promise<Object>} createReport - Commits a new moderation report file to database records.
 * @property {(connectRequestId: string, userId: any) => Promise<Object|null>} findReportByConnectAndUser - Pulls a single report snapshot.
 * @property {(filter: Object) => Promise<number>} countReports - Quantifies historical matching report records.
 * @property {(filter: Object, pagination: { skip: number, limit: number }) => Promise<Object[]>} findReports - Executes a paginated, populated search return.
 * @property {(reportId: string, update: Object) => Promise<Object|null>} findReportByIdAndUpdate - Updates report terminal state indicators atomically.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string, meta?: Object) => void} info - Monitors functional route success logs.
 * @property {(message: string, meta?: Object) => void} warn - Logs best-effort background communication exceptions.
 */

/**
 * Factory function constructing the moderation and complaint processing service layer.
 * * @param {ReportRepository} repo - Abstraction data registry layer instance.
 * @param {{ logger: Logger }} dependencies - Application core telemetry tracing tools.
 * @returns {Object} Configured service interface containing moderation workflows methods.
 */
const createReportService = (repo, { logger }) => {
    /**
     * Processes binary screenshot files, pushes assets to Cloudinary buckets, and records user complaint entries.
     * * @async
     * @function submitReport
     * @param {Object} payload - Combined payload criteria configurations packaging context.
     * @param {string} payload.connectRequestId - Associated unique target platform session identifier.
     * @param {string} payload.complaintType - Taxonomy tracking code categorizing violation reasons.
     * @param {string} payload.description - Narrative character text context explaining violations.
     * @param {any} payload.reportedById - Secure user validation signature key matching creator profiles.
     * @param {Object} [payload.file] - Optional multipart file descriptor containing memory buffers.
     * @param {Buffer} payload.file.buffer - Raw binary data stream mapping.
     * @param {string} payload.file.originalname - Original source file label identifier string.
     * @param {Object} payload.user - Request context user mapping object containing data descriptors.
     * @param {string} payload.user.name - Reporter profile human display identity.
     * @param {string} payload.user.email - Reporter profile contact communication address.
     * @returns {Promise<{ status: number, body: { success: boolean, message: string, report?: Object, message?: string } }>} Internal response layout descriptor.
     */
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
        let screenshotOriginalName = "";

        if (file) {
            const uploaded = await uploadToCloudinary(file.buffer, {
                resource_type: "image",
                public_id: reportScreenshotId(connectRequestId, reportedById),
                type: "authenticated",
                overwrite: false,
                eager: [
                    { width: 200, height: 150, crop: "fill", quality: "auto", fetch_format: "auto" },
                ],
                eager_async: false,
            });
            screenshotUrl = uploaded.secure_url;
            screenshotPublicId = uploaded.public_id;
            screenshotOriginalName = file.originalname;

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
            screenshotOriginalName,
        });

        // ── Send report submitted email (non-blocking) ──
        sendReportSubmittedEmail({
            reporterName: user.name,
            reporterEmail: user.email,
            complaintType,
            description: description.trim(),
            reporterRole,
        }).catch((err) => logger.warn("sendReportSubmittedEmail failed", { error: err.message }))
        return {
            status: 201,
            body: {
                success: true,
                message: "Report submitted successfully. Our team will review it shortly",
                report,
            },
        };
    };

    /**
     * Returns a reporter's filed complaint document, applying crypto-signed file links to secure attachments.
     * * @async
     * @function getMyReport
     * @param {Object} query - Target search selector references container.
     * @param {string} query.connectRequestId - Unique system timeline agreement index.
     * @param {any} query.userId - Secure identity token verification signature checking ownership.
     * @returns {Promise<{ status: number, body: { report: Object|null } }>} Internal response descriptor envelope.
     */
    const getMyReport = async ({ connectRequestId, userId }) => {
        const report = await repo.findReportByConnectAndUser(connectRequestId, userId);
        if (report?.screenshotPublicId) {
            report.screenshotUrl = signCloudinaryUrl(report.screenshotPublicId, "image");
        }
        return { status: 200, body: { report: report || null } };
    };

    /**
     * Compiles a paginated overview listing of submitted reports, filtered optionally by system state codes.
     * * @async
     * @function getAllReports
     * @param {Object} options - Structural pagination limits and filters configuration packet.
     * @param {string} [options.status] - Filter parameter limit constraint checking specific state labels.
     * @param {number|string} [options.page=1] - Dynamic target tracking page index value.
     * @param {number|string} [options.limit=20] - Capacity sizing limit threshold configuration parameters.
     * @returns {Promise<{ status: number, body: { reports: Object[], pagination: Object } }>} Historical complaints list payload.
     */
    const getAllReports = async ({ status, page = 1, limit = 20 }) => {
        const filter = {};
        if (status) filter.status = status;

        const skip = (Number(page) - 1) * Number(limit);
        const total = await repo.countReports(filter);

        const reports = await repo.findReports(filter, { skip, limit: Number(limit) });
        const signedReports = reports.map((report) => {
            if (report.screenshotPublicId) {
                report.screenshotUrl = signCloudinaryUrl(report.screenshotPublicId, "image");
            }
            return report;
        });

        return {
            status: 200,
            body: {
                reports: signedReports,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / Number(limit)),
                },
            },
        };
    };

    /**
     * Alters status properties or attaches management trace notes onto a target complaint record document.
     * Dispatches informational resolution alerts upon transitioning to terminal states.
     * * @async
     * @function updateReportStatus
     * @param {Object} inputContext - Operations parameters block container data.
     * @param {string} inputContext.reportId - Primary database uniqueLookup locator criteria index.
     * @param {string} inputContext.status - Targeted replacement condition state enum ("open", "under_review", "resolved", "dismissed").
     * @param {string} [inputContext.adminNote] - Descriptive moderation summary text variable.
     * @param {any} inputContext.userId - Secure administrator token identity verification pointer.
     * @returns {Promise<{ status: number, body: { success: boolean, report: Object }|{ message: string } }>} Modification execution outcome summaries.
     */
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

        if (status === "resolved" || status === "dismissed") {
            sendReportResolvedEmail({
                reporterName: report.reportedBy.name,
                reporterEmail: report.reportedBy.email,
                complaintType: report.complaintType,
                status,
                adminNote: adminNote?.trim() || "",
            }).catch((err) => logger.warn("sendReportResolvedEmail failed", { error: err.message }))
        }

        return { status: 200, body: { success: true, report } };
    };

    return { submitReport, getMyReport, getAllReports, updateReportStatus };
};
module.exports = createReportService;