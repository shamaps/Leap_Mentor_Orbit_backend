// utils/emailHelpers.js

const LOGO_URL = "https://res.cloudinary.com/dturqwsyo/image/upload/v1775526481/logo_rkj2ta.png";
const BRAND_GRADIENT = "linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%)";
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


/**
 * Formats a date string as "Month D, YYYY" (no weekday) — used for invoices.
 * @param {string} date - "YYYY-MM-DD"
 * @returns {string} e.g. "June 15, 2026", or "—" if date is falsy
 */
const formatDateShort = (date) => {
  if (!date) return "—";
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
};

// Canonical wrapEmail — includes preheader (was missing in sendNotificationEmail.js)
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
        .email-wrapper { border-radius:0 !important; border-left:none !important; border-right:none !important; }
        .email-body { padding:20px 16px !important; }
        .email-header { padding:22px 16px 20px !important; }
        .cta-btn { display:block !important; width:100% !important; box-sizing:border-box !important; text-align:center !important; }
        .slot-row { flex-direction:column !important; align-items:flex-start !important; gap:6px !important; }
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

module.exports = {
    formatTime,
    formatDate,
    formatDateShort,
    wrapEmail,
    buildHeader,
    FOOTER,
    LOGO_URL,
    buildParticipantBlock,
    BRAND_GRADIENT,
    buildSlotRows,
};