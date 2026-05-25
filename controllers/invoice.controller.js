// controllers/invoice.controller.js
const service = require("../services/invoice.service");

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

    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

module.exports = { downloadInvoice };