// controllers/goal.controller.js
const goalService = require("../services/goal.service");

const { logger } = require("@sentry/node");
const handleError = (res, err) =>
  res.status(err.statusCode || 500).json({ message: err.message });

// ─────────────────────────────────────────────────────────────
// POST /api/goals
// ─────────────────────────────────────────────────────────────
const createGoal = async (req, res) => {
  try {
    const data = await goalService.createGoal(req.body, req.user._id);
    logger.info("createGoal completed successfully");
    return res.status(201).json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in goal.controller", { error: err.message, stack: err.stack });
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/goals/:connectRequestId
// ─────────────────────────────────────────────────────────────
const getGoal = async (req, res) => {
  try {
    const data = await goalService.getGoal(req.params.connectRequestId, req.user._id);
    logger.info("getGoal completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in goal.controller", { error: err.message, stack: err.stack });
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/goals/:goalId
// ─────────────────────────────────────────────────────────────
const updateGoal = async (req, res) => {
  try {
    const data = await goalService.updateGoal(req.params.goalId, req.body, req.user._id);
    logger.info("updateGoal completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in goal.controller", { error: err.message, stack: err.stack });
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/goals/:goalId/milestones
// ─────────────────────────────────────────────────────────────
const addMilestone = async (req, res) => {
  try {
    const data = await goalService.addMilestone(req.params.goalId, req.body, req.user._id);
    logger.info("addMilestone completed successfully");
    return res.status(201).json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in goal.controller", { error: err.message, stack: err.stack });
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/milestones/:milestoneId
// ─────────────────────────────────────────────────────────────
const updateMilestone = async (req, res) => {
  try {
    const data = await goalService.updateMilestone(req.params.milestoneId, req.body, req.user._id);
    logger.info("updateMilestone completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in goal.controller", { error: err.message, stack: err.stack });
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/milestones/:milestoneId
// ─────────────────────────────────────────────────────────────
const deleteMilestone = async (req, res) => {
  try {
    const data = await goalService.deleteMilestone(req.params.milestoneId, req.user._id);
    logger.info("deleteMilestone completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in goal.controller", { error: err.message, stack: err.stack });
    return handleError(res, err);
  }
};

module.exports = {
  createGoal,
  getGoal,
  updateGoal,
  addMilestone,
  updateMilestone,
  deleteMilestone,
};