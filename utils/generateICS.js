// backend/utils/generateICS.js

/**
 * Converts "YYYY-MM-DD" + "HH:MM" into ICS datetime format
 * e.g. "2024-03-11" + "09:00" → "20240311T090000"
 */
const toICSDate = (date, time) => {
  const datePart = date.replace(/-/g, ""); // "20240311"
  const timePart = time.replace(":", "") + "00"; // "090000"
  return `${datePart}T${timePart}`;
};

/**
 * Generates a unique ID for the calendar event
 */
const generateUID = (requestId) => {
  return `leapmentor-session-${requestId}@leapmentor.app`;
};

/**
 * Formats current datetime for DTSTAMP field
 * e.g. "20240311T123000Z"
 */
const nowICSDate = () => {
  return new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
};

/**
 * Main function — generates .ics file content string
 *
 * @param {Object} params
 * @param {String} params.requestId   — ConnectRequest _id (used as UID)
 * @param {String} params.mentorName  — mentor's full name
 * @param {String} params.mentorEmail — mentor's email
 * @param {String} params.menteeName  — mentee's full name
 * @param {String} params.menteeEmail — mentee's email
 * @param {String} params.date        — "YYYY-MM-DD"
 * @param {String} params.startTime   — "HH:MM"
 * @param {String} params.endTime     — "HH:MM"
 * @param {String} params.timezone    — e.g. "Asia/Kolkata"
 * @param {String} params.message     — mentee's custom message (used as description)
 *
 * @returns {String} full .ics file content
 */
const generateICS = ({
  requestId,
  mentorName,
  mentorEmail,
  menteeName,
  menteeEmail,
  date,
  startTime,
  endTime,
  timezone = "Asia/Kolkata",
  message = "",
}) => {
  const dtStart  = toICSDate(date, startTime);
  const dtEnd    = toICSDate(date, endTime);
  const dtStamp  = nowICSDate();
  const uid      = generateUID(requestId);

  const summary     = `LeapMentor Session: ${menteeName} with ${mentorName}`;
  const description = message
    ? `Mentorship session on LeapMentor.\\n\\nMessage from ${menteeName}: ${message}`
    : `Mentorship session on LeapMentor between ${menteeName} and ${mentorName}.`;

  //  ICS format — RFC 5545 compliant
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LeapMentor//LeapMentor App//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",             // METHOD:REQUEST makes it show as invite in Gmail/Outlook
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=${timezone}:${dtStart}`,
    `DTEND;TZID=${timezone}:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `ORGANIZER;CN=LeapMentor:mailto:${process.env.FROM_EMAIL?.match(/<(.+)>/)?.[1] || process.env.SMTP_USER}`,
    `ATTENDEE;CN=${mentorName};ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${mentorEmail}`,
    `ATTENDEE;CN=${menteeName};ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${menteeEmail}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",            // reminder 30 min before
    "ACTION:DISPLAY",
    `DESCRIPTION:Reminder: ${summary}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return ics;
};

module.exports = { generateICS };