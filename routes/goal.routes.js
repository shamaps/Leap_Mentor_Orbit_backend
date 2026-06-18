const express          = require("express");
const router           = express.Router();
const { authenticate } = require("../middleware/authenticate");

const { goalController } = require("../config/container");
const {
  createGoal, getGoal, updateGoal, addMilestone, updateMilestone, deleteMilestone,
} = goalController;



// Goal routes
router.post(  "/",                        authenticate, createGoal);
router.get(   "/:connectRequestId",       authenticate, getGoal);
router.patch( "/:goalId",                 authenticate, updateGoal);

// Milestone routes
router.post(  "/:goalId/milestones",      authenticate, addMilestone);
router.patch( "/milestones/:milestoneId", authenticate, updateMilestone);
router.delete("/milestones/:milestoneId", authenticate, deleteMilestone);

module.exports = router;

