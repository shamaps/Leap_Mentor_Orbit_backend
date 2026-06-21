const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middleware/authenticate");

const { goalController } = require("../config/container");
const {
  createGoal, getGoal, updateGoal, addMilestone, updateMilestone, deleteMilestone,
} = goalController;

// Goal routes — goals belong to a connect request, both parties manage them
router.post("/", authenticate, requireRole("mentor", "mentee"), createGoal);
router.get("/:connectRequestId", authenticate, requireRole("mentor", "mentee"), getGoal);
router.patch("/:goalId", authenticate, requireRole("mentor", "mentee"), updateGoal);

// Milestone routes
router.post("/:goalId/milestones", authenticate, requireRole("mentor", "mentee"), addMilestone);
router.patch("/milestones/:milestoneId", authenticate, requireRole("mentor", "mentee"), updateMilestone);
router.delete("/milestones/:milestoneId", authenticate, requireRole("mentor", "mentee"), deleteMilestone);

module.exports = router;