// controllers/goal.controller.js
const { handleError } = require("../utils/appError");
const { ok, created, noContent } = require("../utils/response");
const createGoalController = (goalService, { logger }) => {

// POST /api/goals

const createGoal = async (req, res) => {
  try {
    const data = await goalService.createGoal(req.body, req.user._id);
    logger.info("createGoal completed successfully");
    return created(res, data );
  } catch (err) {
       return handleError(res, err, "goal.createGoal");
  }
};


// GET /api/goals/:connectRequestId

const getGoal = async (req, res) => {
  try {
    const data = await goalService.getGoal(req.params.connectRequestId, req.user._id);
    logger.info("getGoal completed successfully");
    return ok(res, data);
  } catch (err) {
       return handleError(res, err, "goal.getGoal");
  }
};
 
// PATCH /api/goals/:goalId

const updateGoal = async (req, res) => {
  try {
    const data = await goalService.updateGoal(req.params.goalId, req.body, req.user._id);
    logger.info("updateGoal completed successfully");
    return ok(res, data);
  } catch (err) {
       return handleError(res, err, "goal.updateGoal");
  }
};


// POST /api/goals/:goalId/milestones

const addMilestone = async (req, res) => {
  try {
    const data = await goalService.addMilestone(req.params.goalId, req.body, req.user._id);
    logger.info("addMilestone completed successfully");
    return created(res, data);
  } catch (err) {
       return handleError(res, err, "goal.addMilestone");
  }
};


// PATCH /api/milestones/:milestoneId

const updateMilestone = async (req, res) => {
  try {
    const data = await goalService.updateMilestone(req.params.milestoneId, req.body, req.user._id);
    logger.info("updateMilestone completed successfully");
    return ok(res, data);
  } catch (err) {
       return handleError(res, err, "goal.updateMilestone");
  }
};


// DELETE /api/milestones/:milestoneId

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