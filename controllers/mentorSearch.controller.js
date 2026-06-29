// controllers/mentorSearch.controller.js
const { ok } = require("../utils/response");
const { handleError } = require("../utils/appError");

/**
 * @typedef {Object} MentorSearchService
 * @property {(params: Object) => Promise<Object>} searchMentors - Runs the full Atlas or plain list combination search workflows.
 * @property {(params: Object) => Promise<Object>} fallbackSearch - Runs regex pattern search logic on cluster degradation.
 * @property {(queryParams: Object) => Promise<Object[]>} autocompleteMentors - Collects context matching prefix keywords suggestions.
 */

/**
 * Factory assembling presentation layer controller bindings handling inbound routing search arguments.
 * * @param {MentorSearchService} mentorSearchService - Core system searching and indexing orchestration worker module.
 * @param {{ logger: Logger }} dependencies - Application logging trace diagnostics facility.
 * @returns {Object} Grouped controller endpoints route callback actions map configuration.
 */
const createMentorSearchController = (mentorSearchService, { logger }) => {

  /**
   * Express Route Handler reading search parameter objects to emit paginated dashboard metrics envelopes.
   * Catches database context search faults gracefully, automatically pivoting to regex fallback loops.
   * * @async
   * @function searchMentors
   * @param {import('express').Request} req - Augmented request wrapper context containing filter criteria query parameters.
   * @param {import('express').Response} res - Outbound communication transport response connection pipe socket channel.
   */
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

  /**
   * Express Route Handler rendering prefix matches groupings to support real-time user typing workflows.
   * * @async
   * @function autocompleteMentors
   * @param {import('express').Request} req - Inbound network processing block query parameters package container.
   * @param {import('express').Response} res - Operational result array output interface adapter transport connection.
   */
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