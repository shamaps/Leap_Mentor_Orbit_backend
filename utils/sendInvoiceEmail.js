// backend/utils/sendInvoiceEmail.js
const generateInvoice = require("./generateInvoice");
const transporter = require("./mailer");
const {
  wrapEmail,
  buildHeader,
  FOOTER,
} = require("./emailHelpers");

const sendInvoiceEmail = async (params) => {
  const {
    connectRequestId, menteeName, menteeEmail,
    mentorName, sessionRate, sessionCount, totalAmount,
  } = params;

  const invoiceNumber = `INV-${connectRequestId.toString().slice(-6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
  const pdfBuffer = await generateInvoice({ ...params, invoiceNumber });

  const gradient = "linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%)";

  const html = wrapEmail(`
    ${buildHeader(gradient, "Payment Confirmed ✓", `Invoice #${invoiceNumber}`)}

    <div class="email-body" style="padding:24px 32px;">
      <p style="font-size:14px;color:#334155;margin:0 0 18px;">
        Hi <strong>${menteeName}</strong>,<br/>
        Your payment of <strong>${totalAmount} tokens</strong> has been successfully held in escrow
        for your session with <strong>${mentorName}</strong>.
      </p>

      <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid #e2e8f0;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
          Payment Summary
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr>
            <td style="font-size:13px;color:#64748b;padding:5px 0;">Sessions</td>
            <td style="font-size:13px;font-weight:600;color:#1e293b;text-align:right;padding:5px 0;">${sessionCount}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#64748b;padding:5px 0;">Rate per session</td>
            <td style="font-size:13px;font-weight:600;color:#1e293b;text-align:right;padding:5px 0;">${sessionRate} tokens</td>
          </tr>
          <tr>
            <td colspan="2" style="padding:0;"><div style="border-top:1px solid #e2e8f0;margin:8px 0;"></div></td>
          </tr>
          <tr>
            <td style="font-size:14px;font-weight:700;color:#0f172a;padding:5px 0;">Total</td>
            <td style="font-size:14px;font-weight:700;color:#16a34a;text-align:right;padding:5px 0;">${totalAmount} tokens</td>
          </tr>
          <tr>
            <td style="font-size:12px;color:#64748b;padding:5px 0;">Invoice</td>
            <td style="font-size:12px;color:#64748b;text-align:right;padding:5px 0;">${invoiceNumber}</td>
          </tr>
        </table>
      </div>

      <div style="background:#f0fdf4;border-radius:12px;padding:14px 16px;border:1px solid #bbf7d0;margin-bottom:12px;">
        <p style="font-size:13px;color:#15803d;margin:0;font-weight:500;">
          Your tokens are secured in escrow and will be released to the mentor once you confirm the session is complete.
        </p>
      </div>
      <p style="font-size:12px;color:#94a3b8;margin:0;text-align:center;">
        The invoice PDF is attached to this email.
      </p>
    </div>

    ${FOOTER}
  `);

  await transporter.sendMail({
    from: `"Leapmentor" <${process.env.SMTP_USER}>`,
    to: menteeEmail,
    subject: `Your Invoice #${invoiceNumber} — Leapmentor`,
    html,
    attachments: [{ filename: `Invoice-${invoiceNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
  });

  console.log(`✅ Invoice email sent to ${menteeEmail} — ${invoiceNumber}`);
};

module.exports = sendInvoiceEmail;