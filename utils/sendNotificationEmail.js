// backend/utils/sendNotificationEmail.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const formatTime = (time) => {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
};

const formatDate = (date) =>
  new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

const LOGO_URL = "https://res.cloudinary.com/dturqwsyo/image/upload/v1775526481/logo_rkj2ta.png";

// Shared header builder — logo centered, no overlapping elements
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

// Shared footer
const FOOTER = `
  <div style="padding:18px 32px;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="font-size:12px;color:#94a3b8;margin:0;">
      LeapMentor &middot; Empowering the next generation of talent
    </p>
  </div>
`;

// Shared wrapper — responsive max-width, mobile-friendly
const wrapEmail = (innerHtml) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body { margin:0; padding:0; background:#f1f5f9; }
      @media only screen and (max-width:600px) {
        .email-wrapper { border-radius:0 !important; border-left:none !important; border-right:none !important; }
        .email-body { padding:20px 16px !important; }
        .email-header { padding:22px 16px 20px !important; }
        .cta-btn { display:block !important; width:100% !important; box-sizing:border-box !important; text-align:center !important; }
        .slot-row { flex-direction:column !important; align-items:flex-start !important; gap:6px !important; }
      }
    </style>
  </head>
  <body>
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

// Shared participant block — label on its own line, name below, with divider
const buildParticipantBlock = (mentorName, menteeName) => `
  <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid #e2e8f0;">
    <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
      Session Participants
    </div>
    <div style="margin-bottom:10px;">
      <div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">Mentor</div>
      <div style="font-size:14px;font-weight:700;color:#1e293b;">${mentorName}</div>
    </div>
    <div style="border-top:1px solid #e2e8f0;margin-bottom:10px;"></div>
    <div>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">Mentee</div>
      <div style="font-size:14px;font-weight:700;color:#1e293b;">${menteeName}</div>
    </div>
  </div>
`;

const buildSlotRows = (slots = []) =>
  slots.map((slot, i) => `
    <div class="slot-row" style="display:flex;align-items:center;justify-content:space-between;
      padding:10px 14px;border-radius:10px;margin-bottom:8px;
      background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #2563eb;">
      <div>
        <div style="font-size:13px;font-weight:700;color:#1e293b;">
          ${formatDate(slot.date)}
        </div>
        <div style="font-size:12px;color:#64748b;margin-top:2px;">
          ${formatTime(slot.startTime)} &ndash; ${formatTime(slot.endTime)}
        </div>
      </div>
      <span style="font-size:11px;font-weight:700;color:#2563eb;background:#eff6ff;
        padding:3px 8px;border-radius:6px;white-space:nowrap;display:inline-block;
        flex-shrink:0;align-self:center;width:auto;">
        Session ${i + 1}
      </span>
    </div>
  `).join("");

// ─────────────────────────────────────────────────────────────
// Email 1: Mentor notified when mentee sends a connect request
// ─────────────────────────────────────────────────────────────
const sendConnectRequestEmail = async ({
  mentorName,
  mentorEmail,
  menteeName,
  slots = [],
  message = "",
}) => {
  const slotCount = slots.length;
  const slotRowsHtml = buildSlotRows(slots);
  const dashboardLink = `${process.env.APP_BASE_URL}/dashboard/mentor?tab=requests`;

  const html = wrapEmail(`
    ${buildHeader(
    "linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%)",
    "New Connect Request",
    `${menteeName} wants to book a session with you`
  )}

    <div class="email-body" style="padding:24px 32px;">
      <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid #e2e8f0;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
          Mentee
        </div>
        <div style="font-size:15px;font-weight:700;color:#1e293b;">${menteeName}</div>
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
          Message from ${menteeName}
        </div>
        <div style="font-size:13px;color:#334155;line-height:1.6;font-style:italic;">"${message}"</div>
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

  await transporter.sendMail({
    from: `"LeapMentor" <${process.env.SMTP_USER}>`,
    to: mentorEmail,
    subject: `New Connect Request from ${menteeName} — LeapMentor`,
    html,
  });

  console.log(`✅ Connect request email sent to mentor: ${mentorEmail}`);
};

// ─────────────────────────────────────────────────────────────
// Email 2: Mentee notified when mentor accepts the request
// ─────────────────────────────────────────────────────────────
const sendRequestAcceptedEmail = async ({
  menteeName,
  menteeEmail,
  mentorName,
  confirmedSlot,
  slots = [],
}) => {
  const displaySlots = confirmedSlot ? [confirmedSlot] : slots;
  const slotRowsHtml = buildSlotRows(displaySlots);
  const dashboardLink = `${process.env.APP_BASE_URL}/dashboard/mentee?tab=history`;

  const html = wrapEmail(`
    ${buildHeader(
    "linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%)",
    "Your request was accepted!",
    `${mentorName} has accepted your connect request`
  )}

    <div class="email-body" style="padding:24px 32px;">
      <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid #e2e8f0;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
          Your Mentor
        </div>
        <div style="font-size:15px;font-weight:700;color:#1e293b;">${mentorName}</div>
      </div>

      <div style="margin-bottom:18px;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
          Confirmed Session
        </div>
        ${slotRowsHtml}
      </div>

      <div style="background:#fffbeb;border-radius:12px;padding:14px 16px;border:1px solid #fde68a;margin-bottom:18px;">
        <p style="font-size:13px;color:#92400e;margin:0;font-weight:500;">
          Complete your payment on Leapmentor to lock in your session. Tokens are held securely in escrow until the session is complete.
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

  await transporter.sendMail({
    from: `"LeapMentor" <${process.env.SMTP_USER}>`,
    to: menteeEmail,
    subject: `${mentorName} accepted your request — Complete your payment`,
    html,
  });

  console.log(`✅ Request accepted email sent to mentee: ${menteeEmail}`);
};

// ─────────────────────────────────────────────────────────────
// Email 3: Mentor notified when mentee completes payment
// ─────────────────────────────────────────────────────────────
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
  const slotCount = slots.length;
  const slotRowsHtml = buildSlotRows(slots);
  const dashboardLink = `${process.env.APP_BASE_URL}/dashboard/mentor?tab=requests`;

  const html = wrapEmail(`
    ${buildHeader(
    "linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%)",
    "Payment Received",
    `${menteeName} has paid for ${slotCount} session${slotCount > 1 ? "s" : ""} with you`
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

${FOOTER}
  `);

  await transporter.sendMail({
    from: `"LeapMentor" <${process.env.SMTP_USER}>`,
    to: mentorEmail,
    subject: `Payment received from ${menteeName} — ${mentorPayout} tokens in escrow`,
    html,
  });

  console.log(`✅ Payment received email sent to mentor: ${mentorEmail}`);
};

// ─────────────────────────────────────────────────────────────
// Email 4: User notified when admin resolves their support ticket
// ─────────────────────────────────────────────────────────────
const sendSupportResolvedEmail = async ({ toEmail, subject }) => {
  const html = wrapEmail(`
    ${buildHeader(
    "linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%)",
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

  console.log(`✅ Support resolved email sent to: ${toEmail}`);
};

// ─────────────────────────────────────────────────────────────
// Email 5: Both mentor and mentee notified when a slot is cancelled
// ─────────────────────────────────────────────────────────────
const sendSlotCancelledEmail = async ({
  connectRequestId,
  mentorName, mentorEmail,
  menteeName, menteeEmail,
  slot,
  cancelledBy,
  reason = "",
}) => {
  const cancelledByName = cancelledBy === "mentor" ? mentorName : menteeName;
  const dashboardLink = `${process.env.APP_BASE_URL}/shared-dashboard/${connectRequestId}`;

  const buildHtml = (recipientName) => wrapEmail(`
    ${buildHeader(
    "linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)",
    "Session Slot Cancelled",
    `${cancelledByName} has cancelled a session slot`
  )}

    <div class="email-body" style="padding:24px 32px;">
      ${buildParticipantBlock(mentorName, menteeName)}

      <div style="margin-bottom:18px;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
          Cancelled Slot
        </div>
        <div class="slot-row" style="display:flex;align-items:center;justify-content:space-between;
          padding:10px 14px;border-radius:10px;margin-bottom:8px;
          background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #dc2626;">
          <div>
            <div style="font-size:13px;font-weight:700;color:#1e293b;">
              ${formatDate(slot.date)}
            </div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">
              ${formatTime(slot.startTime)} &ndash; ${formatTime(slot.endTime)}
            </div>
          </div>
          <span style="font-size:11px;font-weight:700;color:#dc2626;background:#fee2e2;
            padding:3px 8px;border-radius:6px;white-space:nowrap;display:inline-block;
            flex-shrink:0;align-self:center;width:auto;">CANCELLED</span>
        </div>
      </div>

      ${reason ? `
      <div style="background:#fff7ed;border-radius:12px;padding:14px 16px;margin-bottom:18px;border-left:3px solid #f97316;">
        <div style="font-size:11px;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">
          Reason
        </div>
        <div style="font-size:13px;color:#334155;line-height:1.6;font-style:italic;">"${reason}"</div>
      </div>` : ""}

      <div style="background:#fffbeb;border-radius:12px;padding:14px 16px;border:1px solid #fde68a;margin-bottom:18px;">
        <p style="font-size:13px;color:#92400e;margin:0;font-weight:500;">
          Hi ${recipientName}, this slot has been cancelled by ${cancelledByName}. Please visit your dashboard to view your updated session schedule.
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

  await Promise.all([
    transporter.sendMail({
      from: `"Leapmentor" <${process.env.SMTP_USER}>`,
      to: mentorEmail,
      subject: `Session slot cancelled — ${formatDate(slot.date)} at ${formatTime(slot.startTime)}`,
      html: buildHtml(mentorName),
    }),
    transporter.sendMail({
      from: `"LeapMentor" <${process.env.SMTP_USER}>`,
      to: menteeEmail,
      subject: `Session slot cancelled — ${formatDate(slot.date)} at ${formatTime(slot.startTime)}`,
      html: buildHtml(menteeName),
    }),
  ]);

  console.log(`✅ Slot cancelled emails sent to mentor (${mentorEmail}) and mentee (${menteeEmail})`);
};

// ─────────────────────────────────────────────────────────────
// Email 6: Both mentor and mentee notified when a slot is rescheduled
// ─────────────────────────────────────────────────────────────
const sendSlotRescheduledEmail = async ({
  connectRequestId,
  mentorName, mentorEmail,
  menteeName, menteeEmail,
  oldSlot,
  newSlot,
}) => {
  const dashboardLink = `${process.env.APP_BASE_URL}/shared-dashboard/${connectRequestId}`;

  const buildHtml = (recipientName) => wrapEmail(`
    ${buildHeader(
    "linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%)",
    "Session Rescheduled",
    `${menteeName} has rescheduled a session slot`
  )}

    <div class="email-body" style="padding:24px 32px;">
      ${buildParticipantBlock(mentorName, menteeName)}

      <div style="margin-bottom:18px;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
          Schedule Change
        </div>

        <div class="slot-row" style="display:flex;align-items:center;justify-content:space-between;
          padding:10px 14px;border-radius:10px;margin-bottom:8px;
          background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #dc2626;">
          <div>
            <div style="font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Old Time</div>
            <div style="font-size:13px;font-weight:700;color:#1e293b;">${formatDate(oldSlot.date)}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">${formatTime(oldSlot.startTime)} &ndash; ${formatTime(oldSlot.endTime)}</div>
          </div>
          <span style="font-size:11px;font-weight:700;color:#dc2626;background:#fee2e2;
            padding:3px 8px;border-radius:6px;white-space:nowrap;display:inline-block;
            flex-shrink:0;align-self:center;width:auto;">OLD</span>
        </div>

        <div style="text-align:center;padding:4px 0;font-size:16px;color:#94a3b8;">&#8595;</div>

        <div class="slot-row" style="display:flex;align-items:center;justify-content:space-between;
          padding:10px 14px;border-radius:10px;
          background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #16a34a;">
          <div>
            <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">New Time</div>
            <div style="font-size:13px;font-weight:700;color:#1e293b;">${formatDate(newSlot.date)}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">${formatTime(newSlot.startTime)} &ndash; ${formatTime(newSlot.endTime)}</div>
          </div>
          <span style="font-size:11px;font-weight:700;color:#16a34a;background:#dcfce7;
            padding:3px 8px;border-radius:6px;white-space:nowrap;display:inline-block;
            flex-shrink:0;align-self:center;width:auto;">NEW</span>
        </div>
      </div>

      <div style="background:#eff6ff;border-radius:12px;padding:14px 16px;border-left:3px solid #2563eb;margin-bottom:18px;">
        <p style="font-size:13px;color:#1e40af;margin:0;font-weight:500;">
          Hi ${recipientName}, your session has been rescheduled by ${menteeName}. Please check your dashboard to confirm the updated time.
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

  await Promise.all([
    transporter.sendMail({
      from: `"LeapMentor" <${process.env.SMTP_USER}>`,
      to: mentorEmail,
      subject: `Session rescheduled by ${menteeName} — ${formatDate(newSlot.date)}`,
      html: buildHtml(mentorName),
    }),
    transporter.sendMail({
      from: `"LeapMentor" <${process.env.SMTP_USER}>`,
      to: menteeEmail,
      subject: `Session rescheduled — New time: ${formatDate(newSlot.date)} at ${formatTime(newSlot.startTime)}`,
      html: buildHtml(menteeName),
    }),
  ]);

  console.log(`✅ Slot rescheduled emails sent to mentor (${mentorEmail}) and mentee (${menteeEmail})`);
};

// ─────────────────────────────────────────────────────────────
// Email 7: Both mentor and mentee notified when mentee adds additional session
// ─────────────────────────────────────────────────────────────
const sendAdditionalSlotEmail = async ({
  connectRequestId,
  mentorName, mentorEmail,
  menteeName, menteeEmail,
  slot,
}) => {
  const dashboardLink = `${process.env.APP_BASE_URL}/shared-dashboard/${connectRequestId}`;

  const buildHtml = (recipientName) => wrapEmail(`
    ${buildHeader(
    "linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%)",
    "Additional Session Added",
    `${menteeName} has added a new session slot`
  )}

    <div class="email-body" style="padding:24px 32px;">
      ${buildParticipantBlock(mentorName, menteeName)}

      <div style="margin-bottom:18px;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
          New Session Slot
        </div>
        <div class="slot-row" style="display:flex;align-items:center;justify-content:space-between;
          padding:10px 14px;border-radius:10px;
          background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #16a34a;">
          <div>
            <div style="font-size:13px;font-weight:700;color:#1e293b;">
              ${formatDate(slot.date)}
            </div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">
              ${formatTime(slot.startTime)} &ndash; ${formatTime(slot.endTime)}
            </div>
          </div>
          <span style="font-size:11px;font-weight:700;color:#16a34a;background:#dcfce7;
            padding:3px 8px;border-radius:6px;white-space:nowrap;display:inline-block;
            flex-shrink:0;align-self:center;width:auto;">NEW</span>
        </div>
      </div>

      <div style="background:#eff6ff;border-radius:12px;padding:14px 16px;border-left:3px solid #2563eb;margin-bottom:18px;">
        <p style="font-size:13px;color:#1e40af;margin:0;font-weight:500;">
          Hi ${recipientName}, a new session slot has been added to your ongoing engagement. Visit your dashboard to view the updated schedule.
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

  await Promise.all([
    transporter.sendMail({
      from: `"LeapMentor" <${process.env.SMTP_USER}>`,
      to: mentorEmail,
      subject: `New session slot added by ${menteeName} — LeapMentor`,
      html: buildHtml(mentorName),
    }),
    transporter.sendMail({
      from: `"LeapMentor" <${process.env.SMTP_USER}>`,
      to: menteeEmail,
      subject: `Session slot confirmed — ${formatDate(slot.date)} at ${formatTime(slot.startTime)}`,
      html: buildHtml(menteeName),
    }),
  ]);

  console.log(`✅ Additional slot emails sent to mentor (${mentorEmail}) and mentee (${menteeEmail})`);
};

// ─────────────────────────────────────────────────────────────
// Email 8: Mentor notified when they successfully upload verification documents
// ─────────────────────────────────────────────────────────────
const sendDocumentsSubmittedEmail = async ({ mentorName, mentorEmail }) => {
  const dashboardLink = `${process.env.APP_BASE_URL}/dashboard/mentor`;

  const html = wrapEmail(`
    ${buildHeader(
      "linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%)",
      "Application Received",
      "We've received your verification documents"
    )}

    <div class="email-body" style="padding:24px 32px;">
      <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid #e2e8f0;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
          Applicant
        </div>
        <div style="font-size:15px;font-weight:700;color:#1e293b;">${mentorName}</div>
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

  await transporter.sendMail({
    from:    `"Leapmentor" <${process.env.SMTP_USER}>`,
    to:      mentorEmail,
    subject: `We received your documents — Application under review`,
    html,
  });

  console.log(`✅ Documents submitted email sent to mentor: ${mentorEmail}`);
};

// ─────────────────────────────────────────────────────────────
// Email 9: Mentor notified when admin verifies their profile
// ─────────────────────────────────────────────────────────────
const sendMentorVerifiedEmail = async ({ mentorName, mentorEmail }) => {
  const dashboardLink = `${process.env.APP_BASE_URL}/dashboard/mentor`;

  const html = wrapEmail(`
    ${buildHeader(
      "linear-gradient(135deg,#16a34a 0%,#2563eb 100%)",
      "Account Verified!",
      "Congratulations — you're now a verified mentor"
    )}

    <div class="email-body" style="padding:24px 32px;">
      <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid #e2e8f0;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
          Verified Mentor
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-size:15px;font-weight:700;color:#1e293b;">${mentorName}</div>
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

  await transporter.sendMail({
    from:    `"Leapmentor" <${process.env.SMTP_USER}>`,
    to:      mentorEmail,
    subject: `Your account is verified — Welcome to LeapMentor! 🎉`,
    html,
  });

  console.log(`✅ Mentor verified email sent to: ${mentorEmail}`);
};
// ─────────────────────────────────────────────────────────────
// Email 10: Reporter notified when they successfully submit a report
// ─────────────────────────────────────────────────────────────
const sendReportSubmittedEmail = async ({ reporterName, reporterEmail, complaintType, description,reporterRole }) => {
  const dashboardLink = `${process.env.APP_BASE_URL}/dashboard/${reporterRole === "mentor" ? "mentor" : "mentee"}`;

  const formattedType = complaintType
    .replaceAll("_", " ")
    .replaceAll(/\b\w/g, (c) => c.toUpperCase());

  const html = wrapEmail(`
    ${buildHeader(
      "linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%)",
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
    from:    `"Leapmentor" <${process.env.SMTP_USER}>`,
    to:      reporterEmail,
    subject: `Your report has been received — Leapmentor`,
    html,
  });

  console.log(`✅ Report submitted email sent to: ${reporterEmail}`);
};

// ─────────────────────────────────────────────────────────────
// Email 11: Reporter notified when admin resolves/dismisses their report
// ─────────────────────────────────────────────────────────────
const sendReportResolvedEmail = async ({ reporterName, reporterEmail, complaintType, status, adminNote,reporterRole }) => {
  const dashboardLink = `${process.env.APP_BASE_URL}/dashboard/${reporterRole === "mentor" ? "mentor" : "mentee"}`;

  const isResolved = status === "resolved";

  const formattedType = complaintType
    .replaceAll("_", " ")
    .replaceAll(/\b\w/g, (c) => c.toUpperCase());

  const statusLabel   = isResolved ? "Resolved" : "Dismissed";
  const statusColor   = isResolved ? "#16a34a"  : "#dc2626";
  const statusBg      = isResolved ? "#dcfce7"  : "#fee2e2";
  const headerGradient = isResolved
    ? "linear-gradient(135deg,#16a34a 0%,#2563eb 100%)"
    : "linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)";
  const bannerBg      = isResolved ? "#f0fdf4"  : "#fef2f2";
  const bannerBorder  = isResolved ? "#bbf7d0"  : "#fecaca";
  const bannerText    = isResolved ? "#15803d"  : "#991b1b";
  const bannerMsg     = isResolved
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
    from:    `"Leapmentor" <${process.env.SMTP_USER}>`,
    to:      reporterEmail,
    subject: `Your report has been ${statusLabel.toLowerCase()} — Leapmentor`,
    html,
  });

  console.log(`✅ Report ${statusLabel.toLowerCase()} email sent to: ${reporterEmail}`);
};

module.exports = {
  sendConnectRequestEmail,
  sendRequestAcceptedEmail,
  sendPaymentReceivedEmail,
  sendSupportResolvedEmail,
  sendSlotCancelledEmail,
  sendSlotRescheduledEmail,
  sendAdditionalSlotEmail,
  sendDocumentsSubmittedEmail,  
  sendMentorVerifiedEmail,  
  sendReportSubmittedEmail,
  sendReportResolvedEmail, 
};