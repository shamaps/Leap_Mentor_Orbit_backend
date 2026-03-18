// backend/utils/sendInvoiceEmail.js
const nodemailer = require("nodemailer");
const generateInvoice = require("./generateInvoice");

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Generates invoice PDF and emails it to the mentee
 * @param {Object} params
 * @param {string}   params.connectRequestId
 * @param {string}   params.menteeName
 * @param {string}   params.menteeEmail
 * @param {string}   params.mentorName
 * @param {string}   params.mentorEmail
 * @param {Array}    params.selectedSlots  - ✅ all confirmed slots
 * @param {Object}   [params.confirmedSlot] - kept for backward compat
 * @param {number}   params.sessionRate
 * @param {number}   params.sessionCount
 * @param {number}   params.totalAmount
 * @param {Date}     params.paidAt
 */
const sendInvoiceEmail = async (params) => {
  const {
    connectRequestId,
    menteeName,
    menteeEmail,
    mentorName,
    sessionRate,
    sessionCount,
    totalAmount,
    paidAt,
  } = params;

  // ── Build invoice number from request ID + timestamp ────────
  const invoiceNumber = `INV-${connectRequestId.toString().slice(-6).toUpperCase()}-${Date.now().toString().slice(-4)}`;

  // ── Generate PDF buffer ──────────────────────────────────────
  const pdfBuffer = await generateInvoice({
    ...params,          // ✅ spreads selectedSlots + confirmedSlot through to generateInvoice
    invoiceNumber,
  });

  // ── Send email with PDF attached ─────────────────────────────
  await transporter.sendMail({
    from:    `"Leapmentor" <${process.env.SMTP_USER}>`,
    to:      menteeEmail,
    subject: `Your Invoice #${invoiceNumber} — Leapmentor`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #334155;">
        <div style="background: #1D4ED8; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">Leapmentor</h1>
        </div>
        <div style="background: #F8FAFC; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #E2E8F0;">
          <h2 style="color: #0F172A; margin-top: 0;">Payment Confirmed ✓</h2>
          <p>Hi <strong>${menteeName}</strong>,</p>
          <p>Your payment of <strong>${totalAmount} tokens</strong> has been successfully held in escrow for your session with <strong>${mentorName}</strong>.</p>

          <div style="background: #fff; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px; color: #64748B; font-size: 13px;">PAYMENT SUMMARY</p>
            <p style="margin: 4px 0;"><strong>Sessions:</strong> ${sessionCount}</p>
            <p style="margin: 4px 0;"><strong>Rate per session:</strong> ${sessionRate} tokens</p>
            <p style="margin: 4px 0;"><strong>Total:</strong> ${totalAmount} tokens</p>
            <p style="margin: 4px 0;"><strong>Invoice:</strong> ${invoiceNumber}</p>
          </div>

          <p style="color: #64748B; font-size: 13px;">
            Your tokens are secured in escrow and will be released to the mentor once you confirm the session is complete.
          </p>
          <p style="color: #64748B; font-size: 13px;">The invoice PDF is attached to this email.</p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename:    `Invoice-${invoiceNumber}.pdf`,
        content:     pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  console.log(`✅ Invoice email sent to ${menteeEmail} — ${invoiceNumber}`);
};

module.exports = sendInvoiceEmail;