const transporter = require("../mailer");
const { wrapEmail, buildHeader, FOOTER,BRAND_GRADIENT, LOGO_URL, buildSlotRows, formatTime, formatDate } = require("../emailHelpers");
const { escapeHtml } = require("../escapeHtml");
// Email 5: Both mentor and mentee notified when a slot is cancelled

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
  const safeCancelledByName = escapeHtml(cancelledByName);
  const safeReason = escapeHtml(reason);
    const buildHtml = (recipientName) => wrapEmail(`
    ${buildHeader(
        BRAND_GRADIENT,
        "Session Slot Cancelled",
      `${safeCancelledByName}  has cancelled a session slot`
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
        <div style="font-size:13px;color:#334155;line-height:1.6;font-style:italic;">"${safeReason}"</div>
      </div>` : ""}

      <div style="background:#fffbeb;border-radius:12px;padding:14px 16px;border:1px solid #fde68a;margin-bottom:18px;">
        <p style="font-size:13px;color:#92400e;margin:0;font-weight:500;">
          Hi ${escapeHtml(recipientName)}, this slot has been cancelled by ${safeCancelledByName}. Please visit your dashboard to view your updated session schedule.
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

    await Promise.all([
        transporter.sendMail({
            from: `"LeapMentor" <${process.env.SMTP_USER}>`,
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

    logger.info("Slot cancelled emails sent", { mentorEmail, menteeEmail });
};


// Email 6: Both mentor and mentee notified when a slot is rescheduled

const sendSlotRescheduledEmail = async ({
    connectRequestId,
    mentorName, mentorEmail,
    menteeName, menteeEmail,
    oldSlot,
    newSlot,
}) => {
    const dashboardLink = `${process.env.APP_BASE_URL}/shared-dashboard/${connectRequestId}`;
  const safeMenteeName = escapeHtml(menteeName);
    const buildHtml = (recipientName) => wrapEmail(`
    ${buildHeader(
        BRAND_GRADIENT,
        "Session Rescheduled",
        `${safeMenteeName} has rescheduled a session slot`
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
          Hi ${escapeHtml(recipientName)}, your session has been rescheduled by ${menteeName}. Please check your dashboard to confirm the updated time.
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
          subject: `Session rescheduled by ${menteeName.replace(/[\r\n]/g, "")} — ${formatDate(newSlot.date)}`,
            html: buildHtml(mentorName),
        }),
        transporter.sendMail({
            from: `"LeapMentor" <${process.env.SMTP_USER}>`,
            to: menteeEmail,
            subject: `Session rescheduled — New time: ${formatDate(newSlot.date)} at ${formatTime(newSlot.startTime)}`,
            html: buildHtml(menteeName),
        }),
    ]);

    logger.info("Slot rescheduled emails sent", { mentorEmail, menteeEmail });
};


// Email 7: Both mentor and mentee notified when mentee adds additional session

const sendAdditionalSlotEmail = async ({
    connectRequestId,
    mentorName, mentorEmail,
    menteeName, menteeEmail,
    slot,
}) => {
  const safeMenteeName = escapeHtml(menteeName);
    const dashboardLink = `${process.env.APP_BASE_URL}/shared-dashboard/${connectRequestId}`;

    const buildHtml = (recipientName) => wrapEmail(`
    ${buildHeader(
        BRAND_GRADIENT,
        "Additional Session Added",
      `${safeMenteeName}has added a new session slot`
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
          Hi ${escapeHtml(recipientName)}, a new session slot has been added to your ongoing engagement. Visit your dashboard to view the updated schedule.
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
          subject: `New session slot added by ${menteeName.replace(/[\r\n]/g, "")} — LeapMentor`,
            html: buildHtml(mentorName),
        }),
        transporter.sendMail({
            from: `"LeapMentor" <${process.env.SMTP_USER}>`,
            to: menteeEmail,
            subject: `Session slot confirmed — ${formatDate(slot.date)} at ${formatTime(slot.startTime)}`,
            html: buildHtml(menteeName),
        }),
    ]);

    logger.info("Additional slot emails sent", { mentorEmail, menteeEmail });
};


module.exports = { sendSlotCancelledEmail, sendSlotRescheduledEmail, sendAdditionalSlotEmail };