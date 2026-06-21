const transporter = require("../mailer");
const { wrapEmail, buildHeader, FOOTER, LOGO_URL,BRAND_GRADIENT, buildSlotRows, formatTime, formatDate } = require("../emailHelpers");
const { escapeHtml } = require("../escapeHtml");
// Email 3: Mentor notified when mentee completes payment

const sendPaymentReceivedEmail = async ({
    mentorName,
    mentorEmail,
    menteeName,
    slots = [],
    sessionRate,
    sessionCount,
    mentorPayout,
    commissionRate,
}) => {
  const safeMenteeName = escapeHtml(menteeName);
    const slotCount = slots.length;
    const slotRowsHtml = buildSlotRows(slots);
    const dashboardLink = `${process.env.APP_BASE_URL}/dashboard/mentor?tab=requests`;

    const html = wrapEmail(`
    ${buildHeader(
        BRAND_GRADIENT,
        "Payment Received",
      `${safeMenteeName}has paid for ${slotCount} session${slotCount > 1 ? "s" : ""} with you`
    )}

    <div class="email-body" style="padding:24px 32px;">
      <div style="margin-bottom:18px;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
          Booked Sessions (${slotCount})
        </div>
        ${slotRowsHtml}
      </div>

     <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid #e2e8f0;">
  <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
    Payment Summary
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
    <tr>
      <td style="font-size:13px;color:#64748b;padding:5px 0;">Rate per session</td>
      <td style="font-size:13px;font-weight:600;color:#1e293b;text-align:right;padding:5px 0;">
        ${sessionRate} tokens
      </td>
    </tr>
    <tr>
      <td style="font-size:13px;color:#64748b;padding:5px 0;">Sessions</td>
      <td style="font-size:13px;font-weight:600;color:#1e293b;text-align:right;padding:5px 0;">
        &times; ${sessionCount}
      </td>
    </tr>
    <tr>
      <td style="font-size:13px;color:#64748b;padding:5px 0;">
        Platform fee (${commissionRate}%)
      </td>
      <td style="font-size:13px;font-weight:600;color:#f59e0b;text-align:right;padding:5px 0;">
        deducted by platform
      </td>
    </tr>
    <tr>
      <td colspan="2" style="padding:0;">
        <div style="border-top:1px solid #e2e8f0;margin:8px 0;"></div>
      </td>
    </tr>
    <tr>
      <td style="font-size:14px;font-weight:700;color:#0f172a;padding:5px 0;">
        You will receive
      </td>
      <td style="font-size:14px;font-weight:700;color:#16a34a;text-align:right;padding:5px 0;">
        ${mentorPayout} tokens
      </td>
    </tr>
      </table>
    </div>

    <div style="text-align:center;margin-top:18px;">
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

    await transporter.sendMailWithRetry({
        from: `"LeapMentor" <${process.env.SMTP_USER}>`,
        to: mentorEmail,
      subject: `Payment received from ${menteeName.replace(/[\r\n]/g, "")} — ${mentorPayout} tokens in escrow`,
        html,
    });

    logger.info("Payment received email sent", { mentorEmail });
};


// Email 8: Mentor notified when they successfully upload verification documents

const sendDocumentsSubmittedEmail = async ({ mentorName, mentorEmail }) => {
    const dashboardLink = `${process.env.APP_BASE_URL}/dashboard/mentor`;
  const safeMentorName = escapeHtml(mentorName);
    const html = wrapEmail(`
    ${buildHeader(
        BRAND_GRADIENT,
        "Application Received",
        "We've received your verification documents"
    )}

    <div class="email-body" style="padding:24px 32px;">
      <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid #e2e8f0;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
          Applicant
        </div>
        <div style="font-size:15px;font-weight:700;color:#1e293b;">${safeMentorName}</div>
      </div>

      <div style="background:#eff6ff;border-radius:12px;padding:16px 18px;margin-bottom:18px;border-left:3px solid #2563eb;">
        <p style="font-size:13px;color:#1e40af;margin:0 0 8px;font-weight:600;">
          Thank you for submitting your documents!
        </p>
        <p style="font-size:13px;color:#334155;margin:0;line-height:1.6;">
          Our team will review your profile and documents. This process usually takes <strong>24–48 hours</strong>. 
          You'll receive an email notification once your account has been verified.
        </p>
      </div>

      <div style="background:#f8fafc;border-radius:12px;padding:16px 18px;margin-bottom:18px;border:1px solid #e2e8f0;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
          What happens next?
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <div style="width:22px;height:22px;background:#2563eb;border-radius:50%;display:flex;align-items:center;
              justify-content:center;flex-shrink:0;font-size:11px;font-weight:700;color:#fff;margin-top:1px;">1</div>
            <div style="font-size:13px;color:#334155;line-height:1.5;">Admin reviews your resume and work documents</div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <div style="width:22px;height:22px;background:#2563eb;border-radius:50%;display:flex;align-items:center;
              justify-content:center;flex-shrink:0;font-size:11px;font-weight:700;color:#fff;margin-top:1px;">2</div>
            <div style="font-size:13px;color:#334155;line-height:1.5;">Your profile is verified and activated</div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <div style="width:22px;height:22px;background:#2563eb;border-radius:50%;display:flex;align-items:center;
              justify-content:center;flex-shrink:0;font-size:11px;font-weight:700;color:#fff;margin-top:1px;">3</div>
            <div style="font-size:13px;color:#334155;line-height:1.5;">You're ready to start mentoring on LeapMentor</div>
          </div>
        </div>
      </div>

      <div style="text-align:center;">
        <a href="${dashboardLink}" class="cta-btn"
          style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);
          color:white;font-size:14px;font-weight:700;padding:13px 32px;border-radius:12px;
          text-decoration:none;letter-spacing:0.3px;">
          View Dashboard
        </a>
        <p style="font-size:12px;color:#94a3b8;margin-top:10px;">
          Check your application status anytime
        </p>
      </div>
    </div>

    ${FOOTER}
  `);

    await transporter.sendMailWithRetry({
        from: `"LeapMentor" <${process.env.SMTP_USER}>`,
        to: mentorEmail,
        subject: `We received your documents — Application under review`,
        html,
    });

    logger.info("Documents submitted email sent", { mentorEmail });
};


// Email 9: Mentor notified when admin verifies their profile

const sendMentorVerifiedEmail = async ({ mentorName, mentorEmail }) => {
    const dashboardLink = `${process.env.APP_BASE_URL}/dashboard/mentor`;
    const safeMentorName = escapeHtml(mentorName);
    const html = wrapEmail(`
    ${buildHeader(
        BRAND_GRADIENT,
        "Account Verified!",
        "Congratulations — you're now a verified mentor"
    )}

    <div class="email-body" style="padding:24px 32px;">
      <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid #e2e8f0;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
          Verified Mentor
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-size:15px;font-weight:700;color:#1e293b;">${safeMentorName}</div>
          <span style="font-size:11px;font-weight:700;color:#16a34a;background:#dcfce7;
            padding:3px 8px;border-radius:6px;">VERIFIED</span>
        </div>
      </div>

      <div style="background:#f0fdf4;border-radius:12px;padding:16px 18px;margin-bottom:18px;border:1px solid #bbf7d0;">
        <p style="font-size:13px;color:#15803d;margin:0 0 8px;font-weight:600;">
          Welcome to the LeapMentor mentor community!
        </p>
        <p style="font-size:13px;color:#334155;margin:0;line-height:1.6;">
          Your profile has been reviewed and verified by our admin team. You can now complete your profile 
          and start receiving mentee connect requests.
        </p>
      </div>

      <div style="background:#f8fafc;border-radius:12px;padding:16px 18px;margin-bottom:18px;border:1px solid #e2e8f0;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
          Get started
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <div style="width:22px;height:22px;background:#16a34a;border-radius:50%;display:flex;align-items:center;
              justify-content:center;flex-shrink:0;font-size:11px;font-weight:700;color:#fff;margin-top:1px;">1</div>
            <div style="font-size:13px;color:#334155;line-height:1.5;">Complete your mentor profile with bio, skills and expertise</div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <div style="width:22px;height:22px;background:#16a34a;border-radius:50%;display:flex;align-items:center;
              justify-content:center;flex-shrink:0;font-size:11px;font-weight:700;color:#fff;margin-top:1px;">2</div>
            <div style="font-size:13px;color:#334155;line-height:1.5;">Set your availability so mentees can book sessions</div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <div style="width:22px;height:22px;background:#16a34a;border-radius:50%;display:flex;align-items:center;
              justify-content:center;flex-shrink:0;font-size:11px;font-weight:700;color:#fff;margin-top:1px;">3</div>
            <div style="font-size:13px;color:#334155;line-height:1.5;">Start accepting connect requests from mentees</div>
          </div>
        </div>
      </div>

      <div style="text-align:center;">
        <a href="${dashboardLink}" class="cta-btn"
          style="display:inline-block;background:linear-gradient(135deg,#16a34a,#2563eb);
          color:white;font-size:14px;font-weight:700;padding:13px 32px;border-radius:12px;
          text-decoration:none;letter-spacing:0.3px;">
          Complete Your Profile
        </a>
        <p style="font-size:12px;color:#94a3b8;margin-top:10px;">
          You're one step away from your first session
        </p>
      </div>
    </div>

    ${FOOTER}
  `);

    await transporter.sendMailWithRetry({
        from: `"LeapMentor" <${process.env.SMTP_USER}>`,
        to: mentorEmail,
        subject: `Your account is verified — Welcome to LeapMentor! 🎉`,
        html,
    });

    logger.info("Mentor verified email sent", { mentorEmail });
};


module.exports = { sendPaymentReceivedEmail, sendDocumentsSubmittedEmail, sendMentorVerifiedEmail };