const transporter = require("../mailer");
const { wrapEmail, buildHeader, FOOTER, LOGO_URL, buildSlotRows, formatTime, formatDate,BRAND_GRADIENT } = require("../emailHelpers");
const { escapeHtml } = require("../escapeHtml");
const logger = require("../logger");
const config = require("../../config/env");
// Email 1: Mentor notified when mentee sends a connect request
const sendConnectRequestEmail = async ({
  mentorName,
  mentorEmail,
  menteeName,
  slots = [],
  message = "",
}) => {
  const safeMenteeName = escapeHtml(menteeName);
  const safeMessage = escapeHtml(message);
  const slotCount = slots.length;
  const slotRowsHtml = buildSlotRows(slots);
  const dashboardLink = `${config.appBaseUrl}/dashboard/mentor?tab=requests`;
  const html = wrapEmail(`
    ${buildHeader(
    BRAND_GRADIENT,
    "New Connect Request",
      `${safeMenteeName}wants to book a session with you`
  )}

    <div class="email-body" style="padding:24px 32px;">
      <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid #e2e8f0;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
          Mentee
        </div>
        <div style="font-size:15px;font-weight:700;color:#1e293b;">${safeMenteeName}</div>
      </div>

      <div style="margin-bottom:18px;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
          Proposed Slots (${slotCount})
        </div>
        ${slotRowsHtml}
      </div>

      ${message ? `
      <div style="background:#eff6ff;border-radius:12px;padding:14px 16px;margin-bottom:18px;border-left:3px solid #2563eb;">
        <div style="font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">
          Message from${safeMenteeName}
        </div>
        <div style="font-size:13px;color:#334155;line-height:1.6;font-style:italic;">"${safeMessage}"</div>
      </div>` : ""}

      <div style="background:#f0fdf4;border-radius:12px;padding:14px 16px;border:1px solid #bbf7d0;margin-bottom:18px;">
        <p style="font-size:13px;color:#15803d;margin:0;font-weight:500;">
          Log in to your LeapMentor dashboard to accept or decline this request.
        </p>
      </div>

      <div style="text-align:center;">
        <a href="${dashboardLink}" class="cta-btn"
          style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);
          color:white;font-size:14px;font-weight:700;padding:13px 32px;border-radius:12px;
          text-decoration:none;letter-spacing:0.3px;">
          View Request
        </a>
        <p style="font-size:12px;color:#94a3b8;margin-top:10px;">
          Opens your <strong>Requests</strong> tab directly
        </p>
      </div>
    </div>

    ${FOOTER}
  `);

  await transporter.sendMailWithRetry({
    from: `"LeapMentor" <${config.smtpUser}>`,
    to: mentorEmail,
    subject: `New Connect Request from ${menteeName.replaceAll(/[\r\n]/g, "")} — LeapMentor`,
    html,
  });

  logger.info("Connect request email sent", { mentorEmail });
};

// Email 2: Mentee notified when mentor accepts the request
const sendRequestAcceptedEmail = async ({
  menteeName,
  menteeEmail,
  mentorName,
  confirmedSlot,
  slots = [],
}) => {
  const safeMentorName = escapeHtml(mentorName);

  const displaySlots = confirmedSlot ? [confirmedSlot] : slots;
  const slotRowsHtml = buildSlotRows(displaySlots);
  const dashboardLink = `${config.appBaseUrl}/dashboard/mentee?tab=history`;

  const html = wrapEmail(`
    ${buildHeader(
    BRAND_GRADIENT,
    "Your request was accepted!",
    `${safeMentorName} has accepted your connect request`
  )}

    <div class="email-body" style="padding:24px 32px;">
      <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid #e2e8f0;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
          Your Mentor
        </div>
        <div style="font-size:15px;font-weight:700;color:#1e293b;">${safeMentorName}</div>
      </div>

      <div style="margin-bottom:18px;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
          Confirmed Session
        </div>
        ${slotRowsHtml}
      </div>

      <div style="background:#fffbeb;border-radius:12px;padding:14px 16px;border:1px solid #fde68a;margin-bottom:18px;">
        <p style="font-size:13px;color:#92400e;margin:0;font-weight:500;">
          Complete your payment on LeapMentor to lock in your session. Tokens are held securely in escrow until the session is complete.
        </p>
      </div>

      <div style="text-align:center;">
        <a href="${dashboardLink}" class="cta-btn"
          style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);
          color:white;font-size:14px;font-weight:700;padding:13px 32px;border-radius:12px;
          text-decoration:none;letter-spacing:0.3px;">
          Complete Payment
        </a>
        <p style="font-size:12px;color:#94a3b8;margin-top:10px;">
          Opens your <strong>Session History</strong> tab directly
        </p>
      </div>
    </div>

    ${FOOTER}
  `);

  await transporter.sendMailWithRetry({
    from: `"LeapMentor" <${process.env.SMTP_USER}>`,
    to: menteeEmail,
    subject: `${mentorName.replaceAll(/[\r\n]/g, "")}accepted your request — Complete your payment`,
    html,
  });

  logger.info("Request accepted email sent", { menteeEmail });
};



module.exports = { sendConnectRequestEmail, sendRequestAcceptedEmail };