// optimal/cron/sessionReminders.js
const cron            = require("node-cron");
const ConnectRequest  = require("../models/ConnectRequest");
const makeCreateNotification = require("../utils/createNotification");
const notifRepo = require("../repositories/notification.repository");
const createNotification = makeCreateNotification(notifRepo);
const { PLATFORM_TIMEZONE, IST_OFFSET_MS } = require("../config/constants");
const logger = require("../utils/logger"); 

// ── Helper: convert "YYYY-MM-DD" + "HH:MM" to a JS Date in IST ──

const REMINDER_WINDOW_MINS = 10;       // ±10 min tolerance on each reminder check
const REMINDER_24H_CENTER = 24 * 60;  // 1440 mins
const REMINDER_1H_CENTER = 60;       // 60 mins
const toISTDate = (dateStr, timeStr) => {
  const [year, month, day]   = dateStr.split("-").map(Number);
  const [hours, minutes]     = timeStr.split(":").map(Number);

  // IST = UTC+5:30, so subtract 5h30m to get UTC
  const utcMs =
    Date.UTC(year, month - 1, day, hours, minutes) - IST_OFFSET_MS;

  return new Date(utcMs);
};

// ── Core reminder function ────────────────────────────────────
const sendSessionReminders = async () => {
  try {
    const now = new Date();
    logger.info("Cron: session reminders running", { timestamp: now.toISOString() });

    // Find all accepted requests that have a confirmedSlot
    const acceptedRequests = await ConnectRequest.find({
      status: "accepted",
      confirmedSlot: { $ne: null },
    })
      .populate("mentee", "name email")
      .populate("mentor", "name email")
      .lean();

    let reminder24Count = 0;
    let reminder1Count  = 0;

    for (const request of acceptedRequests) {
      const { confirmedSlot, mentee, mentor } = request;

      if (!confirmedSlot?.date || !confirmedSlot?.startTime) continue;

      const sessionTime = toISTDate(confirmedSlot.date, confirmedSlot.startTime);
      const diffMs      = sessionTime - now;
      const diffMins    = diffMs / (1000 * 60);

      // ── 24-hour reminder window: between 23h50m and 24h10m ──
      if (diffMins >= REMINDER_24H_CENTER - REMINDER_WINDOW_MINS &&
        diffMins <= REMINDER_24H_CENTER + REMINDER_WINDOW_MINS) {
        // Notify mentee
        await createNotification({
          recipient: mentee._id,
          type:      "upcoming_session",
          title:     "Session Tomorrow 📅",
          message:   `Reminder: Your session with ${mentor.name} is tomorrow at ${confirmedSlot.startTime} on ${confirmedSlot.date}.`,
          metadata:  { requestId: request._id, mentorId: mentor._id },
        });

        // Notify mentor
        await createNotification({
          recipient: mentor._id,
          type:      "upcoming_session",
          title:     "Session Tomorrow 📅",
          message:   `Reminder: You have a session with ${mentee.name} tomorrow at ${confirmedSlot.startTime} on ${confirmedSlot.date}.`,
          metadata:  { requestId: request._id, menteeId: mentee._id },
        });

        reminder24Count++;
        logger.info("Cron: 24h reminder sent", { requestId: request._id });
      }

      // ── 1-hour reminder window: between 50m and 70m ──
      if (diffMins >= REMINDER_1H_CENTER - REMINDER_WINDOW_MINS &&
        diffMins <= REMINDER_1H_CENTER + REMINDER_WINDOW_MINS) {
        // Notify mentee
        await createNotification({
          recipient: mentee._id,
          type:      "upcoming_session",
          title:     "Session in 1 Hour ⏰",
          message:   `Your session with ${mentor.name} starts in about 1 hour at ${confirmedSlot.startTime}.`,
          metadata:  { requestId: request._id, mentorId: mentor._id },
        });

        // Notify mentor
        await createNotification({
          recipient: mentor._id,
          type:      "upcoming_session",
          title:     "Session in 1 Hour ⏰",
          message:   `Your session with ${mentee.name} starts in about 1 hour at ${confirmedSlot.startTime}.`,
          metadata:  { requestId: request._id, menteeId: mentee._id },
        });

        reminder1Count++;
        logger.info("Cron: 1h reminder sent", { requestId: request._id });
      }
    }

    logger.info("Cron: session reminders complete", { reminder24Count, reminder1Count });

  } catch (err) {
    logger.error("Cron: session reminder error", { error: err.message, stack: err.stack });
  }
};

// ── Scheduler ─────────────────────────────────────────────────
const startSessionReminderCron = () => {
  // Runs every 10 minutes to catch both 24h and 1h windows
  cron.schedule("*/10 * * * *", sendSessionReminders, {
    timezone: PLATFORM_TIMEZONE,
  });

  logger.info("Cron: session reminders scheduled");
};

module.exports = { startSessionReminderCron, sendSessionReminders };