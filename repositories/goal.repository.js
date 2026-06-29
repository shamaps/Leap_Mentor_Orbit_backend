// repositories/goal.repository.js
const Goal = require("../models/Goal");
const Milestone = require("../models/Milestone");
const ConnectRequest = require("../models/ConnectRequest");

// ─── ConnectRequest ──────────────────────────────────────────

/**
 * Searches ConnectRequest elements providing un-instanced plain dictionary data snapshots.
 * * @function findSessionById
 * @param {string} connectRequestId - Target lookup selection identifier index parameter.
 * @returns {Promise<Object|null>} Lean data record parameters context layout blueprint or null.
 */
const findSessionById = (connectRequestId) =>
    ConnectRequest.findById(connectRequestId).lean();

// ─── Goal ────────────────────────────────────────────────────

/**
 * Checks Goal models matching dynamic criteria parameters targets.
 * * @function findGoalBySession
 * @param {string} connectRequestId - Target tracking locator selection.
 * @returns {Promise<Object|null>} Plain target database summary object map tracking results or null.
 */
const findGoalBySession = (connectRequestId) =>
    Goal.findOne({ connectRequest: connectRequestId }).lean();

/**
 * Selects an interactive Mongoose goal item enabling modification and structural persistence.
 * * @function findGoalById
 * @param {string} goalId - Primary database entry unique system locator key.
 * @returns {Promise<Object|null>} Full hydrated document layout instance template or null.
 */
const findGoalById = (goalId) =>
    Goal.findById(goalId);

/**
 * High-performance stripped data representation for checking goal criteria configurations.
 * * @function findGoalByIdLean
 * @param {string} goalId - Targeted database index reference marker.
 * @returns {Promise<Object|null>} Dehydrated un-instanced database entry plain object or null.
 */
const findGoalByIdLean = (goalId) =>
    Goal.findById(goalId).lean();

/**
 * Registers fresh core mentorship goal mapping models onto persistent infrastructure stores.
 * * @function createGoal
 * @param {Object} data - Schema validation metadata properties configuration container.
 * @returns {Promise<Object>} Freshly written database record model instance return.
 */
const createGoal = (data) =>
    Goal.create(data);

// ─── Milestone ───────────────────────────────────────────────

/**
 * Resolves progress nodes mapped underneath target parents, sorted by specified ranking indices sequential orders.
 * * @function findMilestonesByGoal
 * @param {any} goalId - Associated parent identifier search index locator parameter.
 * @returns {Promise<Object[]>} Ordered arrays listing lean data node dictionaries.
 */
const findMilestonesByGoal = (goalId) =>
    Milestone.find({ goal: goalId }).sort({ order: 1, createdAt: 1 }).lean();

/**
 * Isolates high index ranking nodes determining order offsets.
 * * @function findLastMilestone
 * @param {any} goalId - Associated progress tracking collection criteria.
 * @returns {Promise<Object|null>} Lean document description parameters representing target items, else null.
 */
const findLastMilestone = (goalId) =>
    Milestone.findOne({ goal: goalId }).sort({ order: -1 }).lean();

/**
 * Selects an interactive milestone subcomponent document enabling structural logic processing.
 * * @function findMilestoneById
 * @param {string} milestoneId - Unique system row database identifier key string.
 * @returns {Promise<Object|null>} Full hydrated document template instance structure or null.
 */
const findMilestoneById = (milestoneId) =>
    Milestone.findById(milestoneId);

/**
 * Commits a milestone element mapping properties inside progress collections.
 * * @function createMilestone
 * @param {Object} data - Context variables parameters defined model configurations.
 * @returns {Promise<Object>} Newly created Mongoose row data context return verification.
 */
const createMilestone = (data) =>
    Milestone.create(data);

/**
 * Hard discards progress node structures using specific row targets.
 * * @function deleteMilestoneById
 * @param {string} milestoneId - Primary system lookup parameter index indicator string.
 * @returns {Promise<Object|null>} Operations summary return confirming database metrics details.
 */
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