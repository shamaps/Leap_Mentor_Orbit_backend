// services/invoice.service.js
const generateInvoice = require("../utils/generateInvoice");
const AppError = require("../utils/appError");

/**
 * @typedef {Object} InvoiceRepository
 * @property {(connectRequestId: string) => Promise<Object|null>} findConnectRequestById - Pulls a dynamic session populated with human account vectors.
 * @property {() => Promise<Object|null>} findActiveAdminCommissionRate - Extracts platform configuration percentage settings.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string) => void} info
 * @property {(message: string, error: any) => void} error
 */

/**
 * Factory function constructing the core system Invoice Service layer.
 * * @param {InvoiceRepository} repo - The persistence layer data registry wrapper instance.
 * @param {{ logger: Logger }} dependencies - Application core tracing infrastructure.
 * @returns {Object} Configured service interface containing invoice business logic handlers.
 */
const createInvoiceService = (repo, { logger }) => {
    /**
     * Generate and return a PDF invoice buffer for a paid session.
     * Only the mentee who paid can download the invoice.
     * * @async
     * @function downloadInvoice
     * @param {string} connectRequestId - Dynamic primary session tracking reference key string.
     * @param {any} userId - Secure user identifier signature key checking ownership from request states.
     * @throws {AppError} 400 - If session is unpaid or system percentage metrics are unconfigured.
     * @throws {AppError} 403 - If processing actor credentials fail authorization constraints.
     * @throws {AppError} 404 - If database lookups resolve empty session rows.
     * @returns {Promise<{ pdfBuffer: Buffer, invoiceNumber: string }>} Raw transient file attachment bytes and canonical serial marker.
     */
    const downloadInvoice = async (connectRequestId, userId) => {
        const connectRequest = await repo.findConnectRequestById(connectRequestId);
        if (!connectRequest)
            throw new AppError(404, "Session not found");

        if (connectRequest.mentee._id.toString() !== userId.toString())
            throw new AppError(403, "Not authorized to download this invoice");

        const isPaid = ["paid", "released"].includes(connectRequest.paymentStatus);
        if (!isPaid)
            throw new AppError(400, "No paid invoice found for this session");

        const adminUser = await repo.findActiveAdminCommissionRate();

        if (adminUser?.commissionRate == null)
            throw new AppError(400, "Platform commission rate not configured");

        const invoiceNumber = `INV-${connectRequestId.toString().slice(-6).toUpperCase()}`;

        const pdfBuffer = await generateInvoice({
            invoiceNumber,
            menteeName: connectRequest.mentee.name,
            menteeEmail: connectRequest.mentee.email,
            mentorName: connectRequest.mentor.name,
            mentorEmail: connectRequest.mentor.email,
            selectedSlots: connectRequest.selectedSlots,
            confirmedSlot: connectRequest.confirmedSlot,
            sessionRate: connectRequest.sessionRate,
            sessionCount: connectRequest.sessionCount,
            totalAmount: connectRequest.totalAmount,
            platformFeePercent: adminUser.commissionRate,
            paidAt: connectRequest.paidAt,
        });

        return { pdfBuffer, invoiceNumber };
    };

    return { downloadInvoice };
};
module.exports = createInvoiceService;