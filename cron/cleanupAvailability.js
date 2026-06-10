// backend/cron/cleanupAvailability.js
const cron          = require("node-cron");
const Availability  = require("../models/Availability");
const MentorProfile = require("../models/MentorProfile");
const { PLATFORM_TIMEZONE } = require("../config/constants");

// ── Helper ────────────────────────────────────────────────────
const getTodayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

// ── Core cleanup function ─────────────────────────────────────
const cleanupAvailability = async () => {
  try {
    const today = getTodayStr();
    console.log(`[Cron] Running availability cleanup — ${today}`);

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
          console.log(`[Cron] Auto-unpublished mentor ${avail.mentor} — no future slots left`);
        }
      }
    }

    console.log(`[Cron]  Cleanup complete:`);
    console.log(`[Cron]    • Docs updated    : ${totalDocsUpdated}`);
    console.log(`[Cron]    • Dates removed   : ${totalDatesRemoved}`);
    console.log(`[Cron]    • Mentors unpublished: ${totalUnpublished}`);

  } catch (err) {
    console.error("[Cron] ❌ Cleanup error:", err.message);
  }
};

// ── Scheduler ─────────────────────────────────────────────────
const startCleanupCron = () => {
  // Runs every day at midnight IST
  cron.schedule("0 0 * * *", cleanupAvailability, {
    timezone: PLATFORM_TIMEZONE,
  });

  console.log("[Cron]  Availability cleanup scheduled — runs daily at midnight IST");
};

module.exports = { startCleanupCron, cleanupAvailability };