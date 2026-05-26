// repositories/goal.repository.js
const Goal = require("../models/Goal");
const Milestone = require("../models/Milestone");
const ConnectRequest = require("../models/ConnectRequest");

// ─── ConnectRequest ──────────────────────────────────────────

const findSessionById = (connectRequestId) =>
    ConnectRequest.findById(connectRequestId).lean();

// ─── Goal ────────────────────────────────────────────────────

const findGoalBySession = (connectRequestId) =>
    Goal.findOne({ connectRequest: connectRequestId }).lean();

const findGoalById = (goalId) =>
    Goal.findById(goalId);

const findGoalByIdLean = (goalId) =>
    Goal.findById(goalId).lean();

const createGoal = (data) =>
    Goal.create(data);

// ─── Milestone ───────────────────────────────────────────────

const findMilestonesByGoal = (goalId) =>
    Milestone.find({ goal: goalId }).sort({ order: 1, createdAt: 1 }).lean();

const findLastMilestone = (goalId) =>
    Milestone.findOne({ goal: goalId }).sort({ order: -1 }).lean();

const findMilestoneById = (milestoneId) =>
    Milestone.findById(milestoneId);

const createMilestone = (data) =>
    Milestone.create(data);

const deleteMilestoneById = (milestoneId) =>
    Milestone.findByIdAndDelete(milestoneId);

module.exports = {
    findSessionById,
    findGoalBySession,
    findGoalById,
    findGoalByIdLean,
    createGoal,
    findMilestonesByGoal,
    findLastMilestone,
    findMilestoneById,
    createMilestone,
    deleteMilestoneById,
};