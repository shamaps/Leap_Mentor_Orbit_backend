// backend/utils/sendCalendarInvite.js
const { generateICS } = require("./generateICS");
const { PLATFORM_TIMEZONE } = require("../config/constants");
const transporter = require("./mailer");
const {
  formatTime,
  formatDate,
  wrapEmail,
  buildHeader,
  FOOTER,
  buildSlotRows,
} = require("./emailHelpers");

const sendCalendarInvite = async ({
  requestId, mentorName, mentorEmail,
  menteeName, menteeEmail, slots = [],
  date, startTime, endTime,
  timezone = PLATFORM_TIMEZONE, message = "",
}) => {
  const allSlots = slots.length > 0 ? slots : [{ date, startTime, endTime }];
  const slotCount = allSlots.length;
  const slotRowsHtml = buildSlotRows(allSlots);

  const icsContent = generateICS({
    requestId, mentorName, mentorEmail,
    menteeName, menteeEmail,
    slots: allSlots, timezone, message,
  });

  const icsAttachment = {
    filename: "leapmentor-sessions.ics",
    content: icsContent,
    contentType: "text/calendar; method=REQUEST",
  };

  const gradient = "linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%)";

  // ── Mentee email ──────────────────────────────────────────
  const menteeHtml = wrapEmail(`
    ${buildHeader(
    gradient,
    `Your ${slotCount} session${slotCount > 1 ? "s are" : " is"} confirmed! 🎉`,
    `Payment received · Sessions locked in with ${mentorName}`
  )}
    <div class="email-body" style="padding:24px 32px;">
      <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid #e2e8f0;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Mentor</div>
        <div style="font-size:15px;font-weight:700;color:#1e293b;">${mentorName}</div>
      </div>

      <div style="margin-bottom:18px;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
          Booked Sessions (${slotCount})
        </div>
        ${slotRowsHtml}
      </div>

      ${message ? `
      <div style="background:#eff6ff;border-radius:12px;padding:14px 16px;margin-bottom:18px;border-left:3px solid #2563eb;">
        <div style="font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Your Message</div>
        <div style="font-size:13px;color:#334155;line-height:1.6;font-style:italic;">"${message}"</div>
      </div>` : ""}

      <div style="background:#f0fdf4;border-radius:12px;padding:14px 16px;border:1px solid #bbf7d0;">
        <p style="font-size:13px;color:#15803d;margin:0;font-weight:500;">
          📎 ${slotCount} calendar invite${slotCount > 1 ? "s are" : " is"} attached.
          Add ${slotCount > 1 ? "them" : "it"} to Google Calendar, Outlook, or Apple Calendar.
        </p>
      </div>
    </div>
    ${FOOTER}
  `);

  // ── Mentor email ──────────────────────────────────────────
  const mentorHtml = wrapEmail(`
    ${buildHeader(
    gradient,
    `${slotCount} new session${slotCount > 1 ? "s" : ""} scheduled 📅`,
    `${menteeName} has completed payment · Sessions confirmed`
  )}
    <div class="email-body" style="padding:24px 32px;">
      <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid #e2e8f0;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Mentee</div>
        <div style="font-size:15px;font-weight:700;color:#1e293b;">${menteeName}</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px;">${menteeEmail}</div>
      </div>

      <div style="margin-bottom:18px;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
          Scheduled Sessions (${slotCount})
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

      <div style="background:#f0fdf4;border-radius:12px;padding:14px 16px;border:1px solid #bbf7d0;">
        <p style="font-size:13px;color:#15803d;margin:0;font-weight:500;">
          📎 ${slotCount} calendar invite${slotCount > 1 ? "s are" : " is"} attached.
          Add ${slotCount > 1 ? "them" : "it"} to your calendar to stay on track.
        </p>
      </div>
    </div>
    ${FOOTER}
  `);

  await Promise.all([
    transporter.sendMail({
      from: `"Leapmentor" <${process.env.SMTP_USER}>`,
      to: menteeEmail,
      subject: `✅ ${slotCount} Session${slotCount > 1 ? "s" : ""} Confirmed with ${mentorName}`,
      html: menteeHtml,
      attachments: [icsAttachment],
    }),
    transporter.sendMail({
      from: `"Leapmentor" <${process.env.SMTP_USER}>`,
      to: mentorEmail,
      subject: `📅 ${slotCount} New Session${slotCount > 1 ? "s" : ""} with ${menteeName}`,
      html: mentorHtml,
      attachments: [icsAttachment],
    }),
  ]);

  console.log(`✅ Calendar invites (${slotCount} slot${slotCount > 1 ? "s" : ""}) sent to ${menteeEmail} and ${mentorEmail}`);
};

module.exports = { sendCalendarInvite };