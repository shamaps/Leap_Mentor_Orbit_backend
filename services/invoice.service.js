// services/invoice.service.js
const generateInvoice = require("../utils/generateInvoice");
const AppError = require("../utils/appError");
const createInvoiceService = (repo, { logger }) => {
/**
 * Generate and return a PDF invoice buffer for a paid session.
 * Only the mentee who paid can download the invoice.
 *
 * @param {string}   connectRequestId
 * @param {ObjectId} userId - from req.user._id
 * @returns {Promise<{ pdfBuffer: Buffer, invoiceNumber: string }>}
 */
const downloadInvoice = async (connectRequestId, userId) => {
    // 1 — find the session
    const connectRequest = await repo.findConnectRequestById(connectRequestId);
    if (!connectRequest)
        throw new AppError(404, "Session not found");

    // 2 — authorization: only the mentee can download
    if (connectRequest.mentee._id.toString() !== userId.toString())
        throw new AppError(403, "Not authorized to download this invoice");

    // 3 — must be a paid session
    const isPaid = ["paid", "released"].includes(connectRequest.paymentStatus);
    if (!isPaid)
        throw new AppError(400, "No paid invoice found for this session");

    // 4 — get platform commission rate
    const adminUser = await repo.findActiveAdminCommissionRate();

    // Sonar fix: optional chain replaces (!adminUser || adminUser.commissionRate == null)
    if (adminUser?.commissionRate == null)
        throw new AppError(400, "Platform commission rate not configured");

    // 5 — generate invoice number and PDF
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