// backend/controllers/mentorSearch.controller.js
const { ok, fail } = require("../utils/response");
const createMentorSearchController = (mentorSearchService, { logger }) => {
// GET /api/mentors/search

const searchMentors = async (req, res) => {
  try {
    const result = await mentorSearchService.searchMentors(req.query);
    logger.info("searchMentors completed successfully");
    return ok(res, result);
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
        return ok(res, result);
      } catch (fallbackErr) {
        logger.error("❌ Fallback search error:", fallbackErr.message);
        return fail(res, "Server error", 500);
      }
    }

    return fail(res, "use proper price ranges(min - max)", 500);
  }
};


// GET /api/mentors/autocomplete

const autocompleteMentors = async (req, res) => {
  try {
    const suggestions = await mentorSearchService.autocompleteMentors(req.query);
    logger.info("autocompleteMentors completed successfully");
    return ok(res, suggestions );
  } catch (err) {
    logger.error("❌ Autocomplete error:", err.message);
    return fail(res, "Server error", 500);
  }
};

  return { searchMentors, autocompleteMentors };
};
module.exports = createMentorSearchController;