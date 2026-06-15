// controllers/invoice.controller.js
const service = require("../services/invoice.service");
const { handleError } = require("../utils/AppError");
const logger = require("../utils/logger");
/**
 * GET /api/invoices/:connectRequestId
 * Downloads a PDF invoice for a paid session.
 * Only accessible by the mentee who made the payment.
 */
const downloadInvoice = async (req, res, next) => {
  try {
    const { connectRequestId } = req.params;

    const { pdfBuffer, invoiceNumber } = await service.downloadInvoice(
      connectRequestId,
      req.user._id
    );

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Invoice-${invoiceNumber}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });

    logger.info("downloadInvoice completed successfully");
    return res.send(pdfBuffer);
  } catch (err) {
    return handleError(res, err, "invoice.downloadInvoice");
  }
};

module.exports = { downloadInvoice };