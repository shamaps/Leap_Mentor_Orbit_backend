// controllers/invoice.controller.js
const { handleError } = require("../utils/appError");

/**
 * @typedef {Object} InvoiceService
 * @property {(connectRequestId: string, userId: any) => Promise<{ pdfBuffer: Buffer, invoiceNumber: string }>} downloadInvoice - Orchestrates criteria matching to emit binary records.
 */

/**
 * Factory implementing presenting layer handles bound to inbound Express route loops.
 * * @param {InvoiceService} service - Core underlying business generation layer worker instance.
 * @param {{ logger: Logger }} dependencies - Performance trace logger facility tracking runtime context variables.
 * @returns {Object} Grouped controller routes callback actions mapping container.
 */
const createInvoiceController = (service, { logger }) => {
  /**
   * GET /api/invoices/:connectRequestId
   * Downloads a PDF invoice for a paid session.
   * Only accessible by the mentee who made the payment.
   * * @async
   * @function downloadInvoice
   * @param {import('express').Request & { user: { _id: any } }} req - Intake framework request parsing parameter context holding path items.
   * @param {import('express').Response} res - Standard outbound streaming response socket connector pipeline.
   * @param {import('express').NextFunction} next - Gateway forward loop path descriptor runner link.
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

  return { downloadInvoice };
};
module.exports = createInvoiceController;