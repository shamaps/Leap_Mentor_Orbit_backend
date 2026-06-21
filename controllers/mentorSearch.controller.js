// controllers/mentorSearch.controller.js
const { ok } = require("../utils/response");
const { handleError } = require("../utils/appError");

const createMentorSearchController = (mentorSearchService, { logger }) => {

  const searchMentors = async (req, res) => {
    try {
      const result = await mentorSearchService.searchMentors(req.query);
      logger.info("searchMentors completed successfully");
      return ok(res, result);
    } catch (err) {
      if (err.message?.includes("$search") || err.message?.includes("search index")) {
        logger.warn("Atlas Search unavailable — falling back to regex", { error: err.message });
        try {
          const result = await mentorSearchService.fallbackSearch(req.query);
          logger.info("searchMentors fallback completed successfully");
          return ok(res, result);
        } catch (fallbackErr) {
          return handleError(res, fallbackErr, "mentorSearch.fallbackSearch");
        }
      }
      return handleError(res, err, "mentorSearch.searchMentors");
    }
  };

  const autocompleteMentors = async (req, res) => {
    try {
      const suggestions = await mentorSearchService.autocompleteMentors(req.query);
      logger.info("autocompleteMentors completed successfully");
      return ok(res, suggestions);
    } catch (err) {
      return handleError(res, err, "mentorSearch.autocompleteMentors");
    }
  };

  return { searchMentors, autocompleteMentors };
};
module.exports = createMentorSearchController;