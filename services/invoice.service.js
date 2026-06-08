// services/invoice.service.js
const repo = require("../repositories/invoice.repository");
const generateInvoice = require("../utils/generateInvoice");

const { logger } = require("@sentry/node");
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
        throw Object.assign(new Error("Session not found"), { status: 404 });

    // 2 — authorization: only the mentee can download
    if (connectRequest.mentee._id.toString() !== userId.toString())
        throw Object.assign(new Error("Not authorized to download this invoice"), { status: 403 });

    // 3 — must be a paid session
    const isPaid = ["paid", "released"].includes(connectRequest.paymentStatus);
    if (!isPaid)
        throw Object.assign(new Error("No paid invoice found for this session"), { status: 400 });

    // 4 — get platform commission rate
    const adminUser = await repo.findActiveAdminCommissionRate();

    // ✅ Sonar fix: optional chain replaces (!adminUser || adminUser.commissionRate == null)
    if (adminUser?.commissionRate == null)
        throw Object.assign(new Error("Platform commission rate not configured"), { status: 400 });

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

module.exports = { downloadInvoice };