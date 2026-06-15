// backend/utils/generateICS.js
const { PLATFORM_TIMEZONE } = require("../config/constants");
const toICSDate = (date, time) => {
  const datePart = date.replaceAll("-", "");
  const timePart = time.replaceAll(":", "") + "00";
  return `${datePart}T${timePart}`;
};

const generateUID = (requestId, index = 0) => {
  return `leapmentor-session-${requestId}-slot${index}@leapmentor.app`;
};
const extractEmail = (raw) => {
  if (!raw) return undefined;
  const lt = raw.indexOf("<");
  const gt = raw.indexOf(">", lt);
  return lt !== -1 && gt !== -1 ? raw.slice(lt + 1, gt) : raw.trim();
};
const nowICSDate = () => {
  return new Date().toISOString().replaceAll(/[-:]/g, "").split(".")[0] + "Z";
};

/**
 * Generates a single VEVENT block for one slot
 */
const generateVEVENT = ({
  requestId,
  slotIndex,
  mentorName,
  mentorEmail,
  menteeName,
  menteeEmail,
  date,
  startTime,
  endTime,
  timezone,
  message,
}) => {
  const dtStart     = toICSDate(date, startTime);
  const dtEnd       = toICSDate(date, endTime);
  const dtStamp     = nowICSDate();
  const uid         = generateUID(requestId, slotIndex);
  const summary     = `LeapMentor Session: ${menteeName} with ${mentorName}`;
  const description = message
    ? String.raw`Mentorship session on LeapMentor.\n\nMessage from ${menteeName}: ${message}`
    : `Mentorship session on LeapMentor between ${menteeName} and ${mentorName}.`;

  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=${timezone}:${dtStart}`,
    `DTEND;TZID=${timezone}:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `ORGANIZER;CN=LeapMentor:mailto:${extractEmail(process.env.FROM_EMAIL) || process.env.SMTP_USER}`,
    `ATTENDEE;CN=${mentorName};ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${mentorEmail}`,
    `ATTENDEE;CN=${menteeName};ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${menteeEmail}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:Reminder: ${summary}`,
    "END:VALARM",
    "END:VEVENT",
  ].join("\r\n");
};

/**
 * Generates a .ics file with one VEVENT per slot
 *
 * @param {Object}   params
 * @param {String}   params.requestId
 * @param {String}   params.mentorName
 * @param {String}   params.mentorEmail
 * @param {String}   params.menteeName
 * @param {String}   params.menteeEmail
 * @param {Array}    params.slots       — [{ date, startTime, endTime }]
 * @param {String}   params.timezone
 * @param {String}   params.message
 */
const generateICS = ({
  requestId,
  mentorName,
  mentorEmail,
  menteeName,
  menteeEmail,
  slots = [],
  // ── Legacy single-slot support ────────────────────────────
  date,
  startTime,
  endTime,
  timezone = PLATFORM_TIMEZONE,
  message = "",
}) => {
  // ── Normalise: support both slots[] and legacy single slot ─
  const allSlots = slots.length > 0
    ? slots
    : [{ date, startTime, endTime }];

  const vevents = allSlots.map((slot, i) =>
    generateVEVENT({
      requestId,
      slotIndex:  i,
      mentorName,
      mentorEmail,
      menteeName,
      menteeEmail,
      date:       slot.date,
      startTime:  slot.startTime,
      endTime:    slot.endTime,
      timezone,
      message,
    })
  );

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LeapMentor//LeapMentor App//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n");

  return ics;
};

module.exports = { generateICS };