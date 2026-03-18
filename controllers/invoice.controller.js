// backend/controllers/invoice.controller.js
const ConnectRequest = require("../models/ConnectRequest");
const MentorProfile  = require("../models/MentorProfile");
const User           = require("../models/User");
const generateInvoice = require("../utils/generateInvoice");

/**
 * GET /api/invoices/:connectRequestId
 * Mentee downloads invoice PDF for a paid session
 */
const downloadInvoice = async (req, res) => {
  try {
    const { connectRequestId } = req.params;
    const userId = req.user._id;

    const connectRequest = await ConnectRequest.findById(connectRequestId)
      .populate("mentee", "name email")
      .populate("mentor", "name email")
      .lean();

    if (!connectRequest) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Only the mentee can download their invoice
    if (connectRequest.mentee._id.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized to download this invoice" });
    }

    if (connectRequest.paymentStatus !== "paid" && connectRequest.paymentStatus !== "released") {
      return res.status(400).json({ message: "No paid invoice found for this session" });
    }

    const invoiceNumber = `INV-${connectRequestId.toString().slice(-6).toUpperCase()}`;

    const pdfBuffer = await generateInvoice({
      invoiceNumber,
      menteeName:    connectRequest.mentee.name,
      menteeEmail:   connectRequest.mentee.email,
      mentorName:    connectRequest.mentor.name,
      mentorEmail:   connectRequest.mentor.email,
      selectedSlots: connectRequest.selectedSlots,  // ✅ fixed: was confirmedSlot (single), now all slots
      confirmedSlot: connectRequest.confirmedSlot,  // kept for backward compat fallback in generateInvoice
      sessionRate:   connectRequest.sessionRate,
      sessionCount:  connectRequest.sessionCount,
      totalAmount:   connectRequest.totalAmount,
      paidAt:        connectRequest.paidAt,
    });

    res.set({
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="Invoice-${invoiceNumber}.pdf"`,
      "Content-Length":      pdfBuffer.length,
    });

    return res.send(pdfBuffer);
  } catch (err) {
    console.error("❌ Invoice download error:", err);
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { downloadInvoice };