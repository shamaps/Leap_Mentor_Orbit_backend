const transporter = require("../mailer");
const { wrapEmail, buildHeader, FOOTER, LOGO_URL, formatTime, formatDate } = require("../emailHelpers");

// ─────────────────────────────────────────────────────────────
// Email 4: User notified when admin resolves their support ticket
// ─────────────────────────────────────────────────────────────
const sendSupportResolvedEmail = async ({ toEmail, subject }) => {
  const html = wrapEmail(`
    ${buildHeader(
    BRAND_GRADIENT,
    "Your support request is resolved",
    "Our team has looked into your issue and marked it as resolved."
  )}

    <div class="email-body" style="padding:24px 32px;">
      <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid #e2e8f0;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
          Your Request
        </div>
        <div style="font-size:15px;font-weight:700;color:#1e293b;">${subject}</div>
      </div>

      <div style="background:#f0fdf4;border-radius:12px;padding:14px 16px;border:1px solid #bbf7d0;margin-bottom:18px;">
        <p style="font-size:13px;color:#15803d;margin:0;font-weight:500;">
          If your issue is fully resolved, no further action is needed. If you still need help, feel free to submit a new request from the Help Center in your dashboard.
        </p>
      </div>

      <div style="background:#eff6ff;border-radius:12px;padding:14px 16px;border-left:3px solid #2563eb;">
        <p style="font-size:13px;color:#1e40af;margin:0;font-weight:500;">
          Still having trouble? Open your dashboard &rarr; Help Center &rarr; Send us a message.
        </p>
      </div>
    </div>

    ${FOOTER}
  `);

  await transporter.sendMail({
    from: `"LeapMentor" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `Your support request has been resolved — LeapMentor`,
    html,
  });

  logger.info("Support resolved email sent", { toEmail });
};
// ─────────────────────────────────────────────────────────────
// Email 10: Reporter notified when they successfully submit a report
// ─────────────────────────────────────────────────────────────
const sendReportSubmittedEmail = async ({ reporterName, reporterEmail, complaintType, description, reporterRole }) => {
    const dashboardLink = `${process.env.APP_BASE_URL}/dashboard/${reporterRole === "mentor" ? "mentor" : "mentee"}`;

    const formattedType = complaintType
        .replaceAll("_", " ")
        .replaceAll(/\b\w/g, (c) => c.toUpperCase());

    const html = wrapEmail(`
    ${buildHeader(
        BRAND_GRADIENT,
        "Report Submitted",
        "We've received your report and will review it shortly"
    )}

    <div class="email-body" style="padding:24px 32px;">
      <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid #e2e8f0;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
          Submitted By
        </div>
        <div style="font-size:15px;font-weight:700;color:#1e293b;">${reporterName}</div>
      </div>

      <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid #e2e8f0;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
          Report Details
        </div>
        <div style="margin-bottom:10px;">
          <div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">Complaint Type</div>
          <div style="font-size:14px;font-weight:700;color:#1e293b;">${formattedType}</div>
        </div>
        <div style="border-top:1px solid #e2e8f0;padding-top:10px;">
          <div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">Description</div>
          <div style="font-size:13px;color:#334155;line-height:1.6;font-style:italic;">"${description}"</div>
        </div>
      </div>

      <div style="background:#eff6ff;border-radius:12px;padding:14px 16px;margin-bottom:18px;border-left:3px solid #2563eb;">
        <p style="font-size:13px;color:#1e40af;margin:0;font-weight:500;">
          Our admin team will review your report and take appropriate action. This usually takes <strong>24–48 hours</strong>. You'll receive an email once it's resolved.
        </p>
      </div>

      <div style="text-align:center;">
        <a href="${dashboardLink}" class="cta-btn"
          style="display:inline-block;background:BRAND_GRADIENT;
          color:white;font-size:14px;font-weight:700;padding:13px 32px;border-radius:12px;
          text-decoration:none;letter-spacing:0.3px;">
          View Dashboard
        </a>
      </div>
    </div>

    ${FOOTER}
  `);

    await transporter.sendMail({
        from: `"LeapMentor" <${process.env.SMTP_USER}>`,
        to: reporterEmail,
        subject: `Your report has been received — LeapMentor`,
        html,
    });

    logger.info("Report submitted email sent", { reporterEmail });
};

// ─────────────────────────────────────────────────────────────
// Email 11: Reporter notified when admin resolves/dismisses their report
// ─────────────────────────────────────────────────────────────
const sendReportResolvedEmail = async ({ reporterName, reporterEmail, complaintType, status, adminNote, reporterRole }) => {
    const dashboardLink = `${process.env.APP_BASE_URL}/dashboard/${reporterRole === "mentor" ? "mentor" : "mentee"}`;

    const isResolved = status === "resolved";

    const formattedType = complaintType
        .replaceAll("_", " ")
        .replaceAll(/\b\w/g, (c) => c.toUpperCase());

    const statusLabel = isResolved ? "Resolved" : "Dismissed";
    const statusColor = isResolved ? "#16a34a" : "#dc2626";
    const statusBg = isResolved ? "#dcfce7" : "#fee2e2";
    const headerGradient = isResolved
        ? BRAND_GRADIENT
        : "linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)";
    const bannerBg = isResolved ? "#f0fdf4" : "#fef2f2";
    const bannerBorder = isResolved ? "#bbf7d0" : "#fecaca";
    const bannerText = isResolved ? "#15803d" : "#991b1b";
    const bannerMsg = isResolved
        ? "Your report has been reviewed and resolved by our admin team. Thank you for helping keep LeapMentor safe."
        : "After reviewing your report, our admin team has determined that it does not meet the threshold for action. If you believe this is an error, please contact support.";

    const html = wrapEmail(`
    ${buildHeader(
        headerGradient,
        `Report ${statusLabel}`,
        `An update on your report has been made by our team`
    )}

    <div class="email-body" style="padding:24px 32px;">
      <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid #e2e8f0;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
          Report Summary
        </div>
        <div style="margin-bottom:10px;">
          <div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">Complaint Type</div>
          <div style="font-size:14px;font-weight:700;color:#1e293b;">${formattedType}</div>
        </div>
        <div style="border-top:1px solid #e2e8f0;padding-top:10px;display:flex;align-items:center;gap:10px;">
          <div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">Status</div>
          <span style="font-size:11px;font-weight:700;color:${statusColor};background:${statusBg};
            padding:3px 8px;border-radius:6px;">${statusLabel.toUpperCase()}</span>
        </div>
      </div>

      ${adminNote ? `
      <div style="background:#fffbeb;border-radius:12px;padding:14px 16px;margin-bottom:18px;border-left:3px solid #f59e0b;">
        <div style="font-size:11px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">
          Note from Admin
        </div>
        <div style="font-size:13px;color:#334155;line-height:1.6;font-style:italic;">"${adminNote}"</div>
      </div>` : ""}

      <div style="background:${bannerBg};border-radius:12px;padding:14px 16px;border:1px solid ${bannerBorder};margin-bottom:18px;">
        <p style="font-size:13px;color:${bannerText};margin:0;font-weight:500;">
          ${bannerMsg}
        </p>
      </div>

      <div style="text-align:center;">
        <a href="${dashboardLink}" class="cta-btn"
          style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);
          color:white;font-size:14px;font-weight:700;padding:13px 32px;border-radius:12px;
          text-decoration:none;letter-spacing:0.3px;">
          View Dashboard
        </a>
      </div>
    </div>

    ${FOOTER}
  `);

    await transporter.sendMail({
        from: `"LeapMentor" <${process.env.SMTP_USER}>`,
        to: reporterEmail,
        subject: `Your report has been ${statusLabel.toLowerCase()} — LeapMentor`,
        html,
    });

    logger.info("Report resolved email sent", { reporterEmail });
};


module.exports = { sendSupportResolvedEmail, sendReportSubmittedEmail, sendReportResolvedEmail };