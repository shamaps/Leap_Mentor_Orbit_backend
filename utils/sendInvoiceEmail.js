// backend/utils/sendInvoiceEmail.js
const nodemailer      = require("nodemailer");
const generateInvoice = require("./generateInvoice");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const LOGO_URL = "https://res.cloudinary.com/dturqwsyo/image/upload/v1775526481/logo_rkj2ta.png";

const wrapEmail = (innerHtml) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body { margin:0; padding:0; background:#f1f5f9; }
      .preheader { display:none !important; max-height:0; overflow:hidden; mso-hide:all; }
      @media only screen and (max-width:600px) {
        .email-wrapper { border-radius:0 !important; }
        .email-body { padding:20px 16px !important; }
      }
    </style>
  </head>
  <body>
    <div class="preheader" style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f1f5f9;line-height:1px;">
      &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </div>
    <div style="padding:24px 16px;background:#f1f5f9;">
      <div class="email-wrapper"
        style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;
        overflow:hidden;border:1px solid #e2e8f0;">
        ${innerHtml}
      </div>
    </div>
  </body>
  </html>
`;

const buildHeader = (bgGradient, title, subtitle) => `
  <div style="background:${bgGradient};padding:28px 32px 24px;text-align:center;">
    <div style="margin-bottom:14px;">
      <div style="display:inline-block;background:#ffffff;border-radius:50%;
        width:56px;height:56px;line-height:56px;text-align:center;
        box-shadow:0 2px 8px rgba(0,0,0,0.15);">
        <img src="${LOGO_URL}" alt="LeapMentor" width="36" height="36"
          style="display:inline-block;vertical-align:middle;width:36px;height:36px;object-fit:contain;" />
      </div>
    </div>
    <div style="color:rgba(255,255,255,0.85);font-size:12px;font-weight:700;
      letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">
      LEAPMENTOR
    </div>
    <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0 0 8px;line-height:1.3;">
      ${title}
    </h1>
    <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:0;">
      ${subtitle}
    </p>
  </div>
`;

const FOOTER = `
  <div style="padding:18px 32px;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="font-size:12px;color:#94a3b8;margin:0;">
      LeapMentor &middot; Empowering the next generation of talent
    </p>
  </div>
`;

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