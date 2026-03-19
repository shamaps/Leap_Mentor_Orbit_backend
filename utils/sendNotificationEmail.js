// backend/utils/sendNotificationEmail.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT) || 587,
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

const buildSlotRows = (slots = []) =>
  slots.map((slot, i) => `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:10px 14px;border-radius:10px;margin-bottom:8px;
      background:#f8fafc;border:1px solid #e2e8f0;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:22px;height:22px;background:#2563eb;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          font-size:11px;font-weight:700;color:white;">${i + 1}</div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#1e293b;">
            ${formatDate(slot.date)}
          </div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">
            ${formatTime(slot.startTime)} – ${formatTime(slot.endTime)}
          </div>
        </div>
      </div>
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
  const slotCount   = slots.length;
  const slotRowsHtml = buildSlotRows(slots);

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;
      overflow:hidden;border:1px solid #e2e8f0;">

      <div style="background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);padding:32px 32px 28px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <span style="color:white;font-size:20px;">🚀</span>
          <span style="color:rgba(255,255,255,0.9);font-size:14px;font-weight:600;letter-spacing:0.5px;">LEAPMENTOR</span>
        </div>
        <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;line-height:1.3;">
          New Connect Request 🔔
        </h1>
        <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:8px 0 0;">
          ${menteeName} wants to book a session with you
        </p>
      </div>

      <div style="padding:28px 32px;">
        <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:20px;border:1px solid #e2e8f0;">
          <h2 style="font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 14px;">
            👤 Mentee
          </h2>
          <div style="font-size:15px;font-weight:700;color:#1e293b;">${menteeName}</div>
        </div>

        <div style="margin-bottom:20px;">
          <h2 style="font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">
            📅 Proposed Slots (${slotCount})
          </h2>
          ${slotRowsHtml}
        </div>

        ${message ? `
        <div style="background:#eff6ff;border-radius:12px;padding:16px;margin-bottom:20px;border-left:3px solid #2563eb;">
          <div style="font-size:12px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">
            Message from ${menteeName}
          </div>
          <div style="font-size:14px;color:#334155;line-height:1.6;font-style:italic;">"${message}"</div>
        </div>` : ""}

        <div style="background:#f0fdf4;border-radius:12px;padding:16px;border:1px solid #bbf7d0;">
          <p style="font-size:13px;color:#15803d;margin:0;font-weight:500;">
            Log in to your Leapmentor dashboard to accept or decline this request.
          </p>
        </div>
      </div>

      <div style="padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="font-size:12px;color:#94a3b8;margin:0;">
          LeapMentor · Empowering the next generation of talent
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from:    `"Leapmentor" <${process.env.SMTP_USER}>`,
    to:      mentorEmail,
    subject: `🔔 New Connect Request from ${menteeName} — Leapmentor`,
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
  // Use all slots if confirmedSlot not available, else show confirmed slot
  const displaySlots = confirmedSlot ? [confirmedSlot] : slots;
  const slotRowsHtml = buildSlotRows(displaySlots);

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;
      overflow:hidden;border:1px solid #e2e8f0;">

      <div style="background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);padding:32px 32px 28px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <span style="color:white;font-size:20px;">🚀</span>
          <span style="color:rgba(255,255,255,0.9);font-size:14px;font-weight:600;letter-spacing:0.5px;">LEAPMENTOR</span>
        </div>
        <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;line-height:1.3;">
          Your request was accepted! 🎉
        </h1>
        <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:8px 0 0;">
          ${mentorName} has accepted your connect request
        </p>
      </div>

      <div style="padding:28px 32px;">
        <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:20px;border:1px solid #e2e8f0;">
          <h2 style="font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 14px;">
            👤 Your Mentor
          </h2>
          <div style="font-size:15px;font-weight:700;color:#1e293b;">${mentorName}</div>
        </div>

        <div style="margin-bottom:20px;">
          <h2 style="font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">
            📅 Confirmed Session
          </h2>
          ${slotRowsHtml}
        </div>

        <div style="background:#fffbeb;border-radius:12px;padding:16px;border:1px solid #fde68a;">
          <p style="font-size:13px;color:#92400e;margin:0;font-weight:500;">
            💳 Complete your payment on Leapmentor to lock in your session. Tokens are held securely in escrow until the session is complete.
          </p>
        </div>
      </div>

      <div style="padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="font-size:12px;color:#94a3b8;margin:0;">
          LeapMentor · Empowering the next generation of talent
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from:    `"Leapmentor" <${process.env.SMTP_USER}>`,
    to:      menteeEmail,
    subject: `🎉 ${mentorName} accepted your request — Complete your payment`,
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
  const slotCount    = slots.length;
  const slotRowsHtml = buildSlotRows(slots);

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;
      overflow:hidden;border:1px solid #e2e8f0;">

      <div style="background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);padding:32px 32px 28px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <span style="color:white;font-size:20px;">🚀</span>
          <span style="color:rgba(255,255,255,0.9);font-size:14px;font-weight:600;letter-spacing:0.5px;">LEAPMENTOR</span>
        </div>
        <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;line-height:1.3;">
          Payment received 💳
        </h1>
        <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:8px 0 0;">
          ${menteeName} has paid for ${slotCount} session${slotCount > 1 ? "s" : ""} with you
        </p>
      </div>

      <div style="padding:28px 32px;">

        <div style="margin-bottom:20px;">
          <h2 style="font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">
            📅 Booked Sessions (${slotCount})
          </h2>
          ${slotRowsHtml}
        </div>

        <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:20px;border:1px solid #e2e8f0;">
          <h2 style="font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 14px;">
            💰 Payment Summary
          </h2>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;justify-content:space-between;font-size:13px;">
              <span style="color:#64748b;">Rate per session</span>
              <span style="font-weight:600;color:#1e293b;">${sessionRate} tokens</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;">
              <span style="color:#64748b;">Sessions</span>
              <span style="font-weight:600;color:#1e293b;">× ${sessionCount}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;">
              <span style="color:#64748b;">Platform fee (${commissionRate}%)</span>
              <span style="font-weight:600;color:#f59e0b;">deducted by platform</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:14px;
              padding-top:10px;border-top:1px solid #e2e8f0;margin-top:4px;">
              <span style="font-weight:700;color:#0f172a;">You will receive</span>
              <span style="font-weight:700;color:#16a34a;">${mentorPayout} tokens</span>
            </div>
          </div>
        </div>

        <div style="background:#f0fdf4;border-radius:12px;padding:16px;border:1px solid #bbf7d0;">
          <p style="font-size:13px;color:#15803d;margin:0;font-weight:500;">
            ✅ Tokens are held in escrow and will be released to you automatically once all sessions are marked complete by both parties.
          </p>
        </div>
      </div>

      <div style="padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="font-size:12px;color:#94a3b8;margin:0;">
          LeapMentor · Empowering the next generation of talent
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from:    `"Leapmentor" <${process.env.SMTP_USER}>`,
    to:      mentorEmail,
    subject: `💳 Payment received from ${menteeName} — ${mentorPayout} tokens in escrow`,
    html,
  });

  console.log(`✅ Payment received email sent to mentor: ${mentorEmail}`);
};

module.exports = {
  sendConnectRequestEmail,
  sendRequestAcceptedEmail,
  sendPaymentReceivedEmail,
};