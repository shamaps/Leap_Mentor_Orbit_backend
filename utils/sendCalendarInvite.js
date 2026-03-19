// backend/utils/sendCalendarInvite.js
const nodemailer     = require("nodemailer");
const { generateICS } = require("./generateICS");

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT || 587),
  secure: false,
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

// ── Builds the slot rows HTML for the email body ──────────────
const buildSlotRows = (slots) =>
  slots.map((slot, i) => `
    <div style="display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; border-radius: 10px; margin-bottom: 8px;
      background: #f8fafc; border: 1px solid #e2e8f0;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 22px; height: 22px; background: #2563eb; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: white;">${i + 1}</div>
        <div>
          <div style="font-size: 13px; font-weight: 700; color: #1e293b;">
            ${formatDate(slot.date)}
          </div>
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
            ${formatTime(slot.startTime)} – ${formatTime(slot.endTime)}
          </div>
        </div>
      </div>
    </div>
  `).join("");

/**
 * Sends calendar invite email with ALL slots to both mentor and mentee.
 * One .ics attachment containing a VEVENT per slot.
 *
 * @param {Object}  params
 * @param {String}  params.requestId
 * @param {String}  params.mentorName
 * @param {String}  params.mentorEmail
 * @param {String}  params.menteeName
 * @param {String}  params.menteeEmail
 * @param {Array}   params.slots      — [{ date, startTime, endTime }] all booked slots
 * @param {String}  params.timezone
 * @param {String}  params.message
 * — Legacy single-slot params still supported (date, startTime, endTime)
 */
const sendCalendarInvite = async ({
  requestId,
  mentorName,
  mentorEmail,
  menteeName,
  menteeEmail,
  slots = [],
  // legacy single-slot fallback
  date,
  startTime,
  endTime,
  timezone = "Asia/Kolkata",
  message  = "",
}) => {
  // ── Normalise slots ───────────────────────────────────────
  const allSlots = slots.length > 0
    ? slots
    : [{ date, startTime, endTime }];

  // ── Generate one .ics with all VEVENTs ────────────────────
  const icsContent = generateICS({
    requestId,
    mentorName,
    mentorEmail,
    menteeName,
    menteeEmail,
    slots: allSlots,
    timezone,
    message,
  });

  const icsAttachment = {
    filename:    "leapmentor-sessions.ics",
    content:     icsContent,
    contentType: "text/calendar; method=REQUEST",
  };

  const slotCount   = allSlots.length;
  const slotRowsHtml = buildSlotRows(allSlots);

  // ── Email to MENTEE ───────────────────────────────────────
  const menteeHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px;
      overflow: hidden; border: 1px solid #e2e8f0;">

      <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 32px 32px 28px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
          <span style="color: white; font-size: 20px;">🚀</span>
          <span style="color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 600; letter-spacing: 0.5px;">LEAPMENTOR</span>
        </div>
        <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0; line-height: 1.3;">
          Your ${slotCount} session${slotCount > 1 ? "s are" : " is"} confirmed! 🎉
        </h1>
        <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 8px 0 0;">
          Payment received · Sessions locked in with ${mentorName}
        </p>
      </div>

      <div style="padding: 28px 32px;">

        <div style="background: #f8fafc; border-radius: 12px; padding: 20px;
          margin-bottom: 20px; border: 1px solid #e2e8f0;">
          <h2 style="font-size: 13px; font-weight: 700; color: #94a3b8;
            text-transform: uppercase; letter-spacing: 1px; margin: 0 0 14px;">
            👤 Mentor
          </h2>
          <div style="font-size: 15px; font-weight: 700; color: #1e293b;">${mentorName}</div>
        </div>

        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 13px; font-weight: 700; color: #94a3b8;
            text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px;">
            📅 Booked Sessions (${slotCount})
          </h2>
          ${slotRowsHtml}
        </div>

        ${message ? `
        <div style="background: #eff6ff; border-radius: 12px; padding: 16px;
          margin-bottom: 20px; border-left: 3px solid #2563eb;">
          <div style="font-size: 12px; font-weight: 700; color: #2563eb;
            text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Your Message</div>
          <div style="font-size: 14px; color: #334155; line-height: 1.6; font-style: italic;">"${message}"</div>
        </div>` : ""}

        <div style="background: #f0fdf4; border-radius: 12px; padding: 16px; border: 1px solid #bbf7d0;">
          <p style="font-size: 13px; color: #15803d; margin: 0; font-weight: 500;">
            📎 ${slotCount} calendar invite${slotCount > 1 ? "s are" : " is"} attached.
            Add ${slotCount > 1 ? "them" : "it"} to Google Calendar, Outlook, or Apple Calendar.
          </p>
        </div>
      </div>

      <div style="padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">
          LeapMentor · Empowering the next generation of talent
        </p>
      </div>
    </div>
  `;

  // ── Email to MENTOR ───────────────────────────────────────
  const mentorHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px;
      overflow: hidden; border: 1px solid #e2e8f0;">

      <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 32px 32px 28px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
          <span style="color: white; font-size: 20px;">🚀</span>
          <span style="color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 600; letter-spacing: 0.5px;">LEAPMENTOR</span>
        </div>
        <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0; line-height: 1.3;">
          ${slotCount} new session${slotCount > 1 ? "s" : ""} scheduled 📅
        </h1>
        <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 8px 0 0;">
          ${menteeName} has completed payment · Sessions confirmed
        </p>
      </div>

      <div style="padding: 28px 32px;">

        <div style="background: #f8fafc; border-radius: 12px; padding: 20px;
          margin-bottom: 20px; border: 1px solid #e2e8f0;">
          <h2 style="font-size: 13px; font-weight: 700; color: #94a3b8;
            text-transform: uppercase; letter-spacing: 1px; margin: 0 0 14px;">
            👤 Mentee
          </h2>
          <div style="font-size: 15px; font-weight: 700; color: #1e293b;">${menteeName}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">${menteeEmail}</div>
        </div>

        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 13px; font-weight: 700; color: #94a3b8;
            text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px;">
            📅 Scheduled Sessions (${slotCount})
          </h2>
          ${slotRowsHtml}
        </div>

        ${message ? `
        <div style="background: #eff6ff; border-radius: 12px; padding: 16px;
          margin-bottom: 20px; border-left: 3px solid #2563eb;">
          <div style="font-size: 12px; font-weight: 700; color: #2563eb;
            text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
            Message from ${menteeName}
          </div>
          <div style="font-size: 14px; color: #334155; line-height: 1.6; font-style: italic;">"${message}"</div>
        </div>` : ""}

        <div style="background: #f0fdf4; border-radius: 12px; padding: 16px; border: 1px solid #bbf7d0;">
          <p style="font-size: 13px; color: #15803d; margin: 0; font-weight: 500;">
            📎 ${slotCount} calendar invite${slotCount > 1 ? "s are" : " is"} attached.
            Add ${slotCount > 1 ? "them" : "it"} to your calendar to stay on track.
          </p>
        </div>
      </div>

      <div style="padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">
          LeapMentor · Empowering the next generation of talent
        </p>
      </div>
    </div>
  `;

  // ── Send both emails in parallel ──────────────────────────
  await Promise.all([
    transporter.sendMail({
      from:        process.env.FROM_EMAIL,
      to:          menteeEmail,
      subject:     `✅ ${slotCount} Session${slotCount > 1 ? "s" : ""} Confirmed with ${mentorName}`,
      html:        menteeHtml,
      attachments: [icsAttachment],
    }),
    transporter.sendMail({
      from:        process.env.FROM_EMAIL,
      to:          mentorEmail,
      subject:     `📅 ${slotCount} New Session${slotCount > 1 ? "s" : ""} with ${menteeName}`,
      html:        mentorHtml,
      attachments: [icsAttachment],
    }),
  ]);

  console.log(`✅ Calendar invites (${slotCount} slot${slotCount > 1 ? "s" : ""}) sent to ${menteeEmail} and ${mentorEmail}`);
};

module.exports = { sendCalendarInvite };