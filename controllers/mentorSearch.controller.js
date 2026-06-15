// backend/controllers/mentorSearch.controller.js
const mentorSearchService = require("../services/mentorSearch.service");

const logger = require("../utils/logger");
// ─────────────────────────────────────────────────────────────
// GET /api/mentors/search
// ─────────────────────────────────────────────────────────────
const searchMentors = async (req, res) => {
  try {
    const result = await mentorSearchService.searchMentors(req.query);
    logger.info("searchMentors completed successfully");
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    logger.error("❌ Mentor search error:", err.message);

    if (err.message?.includes("$search") || err.message?.includes("search index")) {
      logger.warn("⚠️  Atlas Search unavailable — falling back to regex");
      // FIX: "Handle this exception or don't catch it at all" —
      // the fallback is now awaited and its result returned, so the
      // original error is handled (not silently swallowed).
      try {
        const result = await mentorSearchService.fallbackSearch(req.query);
        logger.info("searchMentors completed successfully");
        return res.status(200).json({ success: true, ...result });
      } catch (fallbackErr) {
        logger.error("❌ Fallback search error:", fallbackErr.message);
        return res.status(500).json({ success: false, message: "Server error" });
      }
    }

    return res.status(500).json({ success: false, message: "use proper price ranges(min - max)" });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/mentors/autocomplete
// ─────────────────────────────────────────────────────────────
const autocompleteMentors = async (req, res) => {
  try {
    const suggestions = await mentorSearchService.autocompleteMentors(req.query);
    logger.info("autocompleteMentors completed successfully");
    return res.status(200).json({ success: true, suggestions });
  } catch (err) {
    logger.error("❌ Autocomplete error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { searchMentors, autocompleteMentors };