// controllers/goal.controller.js
const { handleError } = require("../utils/appError");
const { ok, created, noContent } = require("../utils/response");

/**
 * @typedef {Object} GoalService
 * @property {(body: Object, userId: any) => Promise<Object>} createGoal
 * @property {(connectRequestId: string, userId: any) => Promise<Object>} getGoal
 * @property {(goalId: string, body: Object, userId: any) => Promise<Object>} updateGoal
 * @property {(goalId: string, body: Object, userId: any) => Promise<Object>} addMilestone
 * @property {(milestoneId: string, body: Object, userId: any) => Promise<Object>} updateMilestone
 * @property {(milestoneId: string, userId: any) => Promise<{message: string}>} deleteMilestone
 */

/**
 * Factory constructing entry controllers layer handling presentation network route loops.
 * * @param {GoalService} goalService - Core progress orchestration underlying worker service instance.
 * @param {{ logger: Object }} dependencies - Metric context trace logging framework capturing diagnostics.
 * @returns {Object} Grouped controller routes callback actions mapping container.
 */
const createGoalController = (goalService, { logger }) => {

  /**
   * Express Route Handler writing a new mentorship channel baseline progress tracking goal.
   * * @async
   * @function createGoal
   * @param {import('express').Request & { user: { _id: any } }} req - Input request message context framework containing body data parameters.
   * @param {import('express').Response} res - Standard connection return output transport pipeline.
   */
  const createGoal = async (req, res) => {
    try {
      const data = await goalService.createGoal(req.body, req.user._id);
      logger.info("createGoal completed successfully");
      return created(res, data);
    } catch (err) {
      return handleError(res, err, "goal.createGoal");
    }
  };

  /**
   * Express Route Handler pulling targets progress roadmap collections sorted and structured.
   * * @async
   * @function getGoal
   * @param {import('express').Request & { user: { _id: any } }} req - Route context state parsing variable holding parameters paths.
   * @param {import('express').Response} res - Data transmission transport result channel closure link.
   */
  const getGoal = async (req, res) => {
    try {
      const data = await goalService.getGoal(req.params.connectRequestId, req.user._id);
      logger.info("getGoal completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "goal.getGoal");
    }
  };

  /**
   * Express Route Handler altering baseline settings or state paths on a target progress object.
   * * @async
   * @function updateGoal
   * @param {import('express').Request & { user: { _id: any } }} req - Operational context container specifying criteria delta fields.
   * @param {import('express').Response} res - Dynamic execution layout data output interface socket.
   */
  const updateGoal = async (req, res) => {
    try {
      const data = await goalService.updateGoal(req.params.goalId, req.body, req.user._id);
      logger.info("updateGoal completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "goal.updateGoal");
    }
  };

  /**
   * Express Route Handler appending roadmap progress indicator nodes underneath target objectives.
   * * @async
   * @function addMilestone
   * @param {import('express').Request & { user: { _id: any } }} req - Intake payload parameters mapping dynamic variables package context.
   * @param {import('express').Response} res - Data output channel connector transport interface.
   */
  const addMilestone = async (req, res) => {
    try {
      const data = await goalService.addMilestone(req.params.goalId, req.body, req.user._id);
      logger.info("addMilestone completed successfully");
      return created(res, data);
    } catch (err) {
      return handleError(res, err, "goal.addMilestone");
    }
  };

  /**
   * Express Route Handler modifying parameters or updating complete validation metrics on structural nodes.
   * * @async
   * @function updateMilestone
   * @param {import('express').Request & { user: { _id: any } }} req - Input target identifier framework with updates body elements.
   * @param {import('express').Response} res - Structural payload interface output return connector.
   */
  const updateMilestone = async (req, res) => {
    try {
      const data = await goalService.updateMilestone(req.params.milestoneId, req.body, req.user._id);
      logger.info("updateMilestone completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "goal.updateMilestone");
    }
  };

  /**
   * Express Route Handler purging a single milestone progress element out of timeline channels.
   * * @async
   * @function deleteMilestone
   * @param {import('express').Request & { user: { _id: any } }} req - Secure context frame specifying targeted row indicators.
   * @param {import('express').Response} res - Direct termination method transport interface closure.
   */
  const deleteMilestone = async (req, res) => {
    try {
      await goalService.deleteMilestone(req.params.milestoneId, req.user._id);
      logger.info("deleteMilestone completed successfully");
      return noContent(res);
    } catch (err) {
      return handleError(res, err, "goal.deleteMilestone");
    }
  };

  return { createGoal, getGoal, updateGoal, addMilestone, updateMilestone, deleteMilestone };
};

module.exports = createGoalController;