// backend/cron/cleanupAvailability.js
const cron          = require("node-cron");
const Availability  = require("../models/Availability");
const MentorProfile = require("../models/MentorProfile");
const { PLATFORM_TIMEZONE } = require("../config/constants");
const logger = require("../utils/logger");
// ── Helper ────────────────────────────────────────────────────
const getTodayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

// ── Core cleanup function ─────────────────────────────────────
const cleanupAvailability = async () => {
  try {
    const today = getTodayStr();
    logger.info("Cron: availability cleanup running", { today });

    // Fetch all availability docs that have at least one date
    const allAvailability = await Availability.find({
      "specificDates.0": { $exists: true },
    });

    let totalDocsUpdated = 0;
    let totalDatesRemoved = 0;
    let totalUnpublished = 0;

    for (const avail of allAvailability) {
      const before = avail.specificDates.length;

      // Keep only future dates
      avail.specificDates = avail.specificDates.filter(
        (d) => d.date >= today
      );

      const removed = before - avail.specificDates.length;

      // Only save if something actually changed
      if (removed > 0) {
        totalDatesRemoved += removed;
        totalDocsUpdated  += 1;

        await avail.save();

        //  Auto-unpublish mentor if no future slots remain
        if (avail.specificDates.length === 0) {
          await MentorProfile.findOneAndUpdate(
            { user: avail.mentor },
            { isProfilePublished: false }
          );
          totalUnpublished += 1;
          logger.info("Cron: mentor auto-unpublished", { mentorId: avail.mentor });
        }
      }
    }

    logger.info("Cron: availability cleanup complete", { totalDocsUpdated, totalDatesRemoved, totalUnpublished });
   

  } catch (err) {
    logger.error("Cron: availability cleanup error", { error: err.message, stack: err.stack });
  }
};

// ── Scheduler ─────────────────────────────────────────────────
const startCleanupCron = () => {
  // Runs every day at midnight IST
  cron.schedule("0 0 * * *", cleanupAvailability, {
    timezone: PLATFORM_TIMEZONE,
  });

  logger.info("Cron: availability cleanup scheduled");
};

module.exports = { startCleanupCron, cleanupAvailability };