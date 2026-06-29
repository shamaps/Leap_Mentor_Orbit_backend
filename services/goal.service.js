// services/goal.service.js
const socketHandler = require("../socket/socketHandler");
const { VALID_GOAL_STATUSES } = require("../config/constants");
const AppError = require("../utils/appError");
const { toGoalDTO, toMilestoneDTO } = require("../utils/mappers/goal.mapper");

/**
 * @typedef {Object} SessionParticipantConfig
 * @property {any} mentor - Unique user identity tracker for the mentor.
 * @property {any} mentee - Unique user identity tracker for the mentee.
 * @property {string} status - Dynamic session status metric value ("ongoing" vs others).
 */

/**
 * @typedef {Object} GoalRepository
 * @property {(connectRequestId: string) => Promise<SessionParticipantConfig|null>} findSessionById - Pulls runtime session parameters.
 * @property {(connectRequestId: string) => Promise<Object|null>} findGoalBySession - Looks up existing session-bound goals.
 * @property {(goalId: string) => Promise<Object|null>} findGoalById - Resolves full interactive Mongoose goal documents.
 * @property {(goalId: string) => Promise<Object|null>} findGoalByIdLean - High-performance read-only goal template query.
 * @property {(data: Object) => Promise<Object>} createGoal - Persists a fresh milestone blueprint record.
 * @property {(goalId: any) => Promise<Object[]>} findMilestonesByGoal - Resolves ordered milestone collections.
 * @property {(goalId: any) => Promise<Object|null>} findLastMilestone - Resolves upper bounding sequence metrics for rendering orders.
 * @property {(milestoneId: string) => Promise<Object|null>} findMilestoneById - Pulls interactive Mongoose milestone documents.
 * @property {(data: Object) => Promise<Object>} createMilestone - Commits a fresh targeted milestone entry.
 * @property {(milestoneId: string) => Promise<Object|null>} deleteMilestoneById - Discards tracking entries from databases.
 */

/**
 * Factory function assembling business processing rules for Goals and Milestones orchestration.
 * * @param {GoalRepository} goalRepo - The persistence registry data interface layer.
 * @param {{ logger: Object }} dependencies - Metric tracking and log instrumentation module.
 * @returns {Object} Configured object map exposing mentorship progress tracking methods.
 */
const createGoalService = (goalRepo, { logger }) => {

    /**
     * Broadcasts event message states across isolated dynamic session socket rooms.
     * * @private
     * @function emitToRoom
     * @param {any} connectRequestId - The room indicator index mapping identifier.
     * @param {string} event - Inter-process notification communication literal key label.
     * @param {Object} data - Context parameter tracking structural state payload envelopes.
     */
    const emitToRoom = (connectRequestId, event, data) => {
        try {
            if (socketHandler.io) {
                socketHandler.io.to(connectRequestId.toString()).emit(event, data);
            }
        } catch (err) {
            logger.warn("Socket emit failed", { error: err.message });
        }
    };

    /**
     * Verifies if performing credentials exist inside verified participant lists.
     * * @private
     * @function assertParticipant
     * @param {SessionParticipantConfig} session - Target engagement tracking data row context.
     * @param {any} userId - Secure user validation signature key checking ownership.
     * @returns {boolean} True if identity indexes align against target properties.
     */
    const assertParticipant = (session, userId) => {
        const uid = userId.toString();
        return (
            session.mentor.toString() === uid ||
            session.mentee.toString() === uid
        );
    };

    /**
     * Registers a baseline mentorship goal timeline structure restricted to ongoing session channels.
     * * @async
     * @function createGoal
     * @param {Object} body - Input parameters package mapping criteria body.
     * @param {string} body.connectRequestId - Associated primary engagement identifier tracking entries.
     * @param {string} body.title - Literal label specifying goal purposes.
     * @param {string} [body.description] - Optional details context.
     * @param {string|Date} [body.startDate] - Target starting boundaries parameter calendar tracker.
     * @param {string|Date} [body.endDate] - Target closing boundaries parameter calendar tracker.
     * @param {any} userId - Originating session user reference identity index token.
     * @throws {AppError} 400 - If required strings are empty or dynamic channel states are not "ongoing".
     * @throws {AppError} 403 - If security credentials checks drop below authorized baseline bounds.
     * @throws {AppError} 404 - If the parent interactive session context returns missing descriptors.
     * @throws {AppError} 409 - If duplicate goal allocations are already mapped to target sessions.
     * @returns {Promise<{goal: Object}>} Formatted data transfer object summary payload.
     */
    const createGoal = async (body, userId) => {
        const { connectRequestId, title, description, startDate, endDate } = body;

        if (!connectRequestId) {
            throw new AppError(400, "connectRequestId is required");
        }

        if (!title?.trim()) {
            throw new AppError(400, "title is required");
        }

        const session = await goalRepo.findSessionById(connectRequestId);
        if (!session) {
            throw new AppError(404, "Session not found");
        }

        if (session.status !== "ongoing") {
            throw new AppError(400, "Goals can only be set for ongoing sessions");
        }

        if (!assertParticipant(session, userId)) {
            throw new AppError(403, "Not authorized");
        }

        const existing = await goalRepo.findGoalBySession(connectRequestId);
        if (existing) {
            throw new AppError(409, "A goal already exists for this session");
        }

        const goal = await goalRepo.createGoal({
            connectRequest: connectRequestId,
            mentor: session.mentor,
            mentee: session.mentee,
            title: title.trim(),
            description: description?.trim() || "",
            startDate: startDate || null,
            endDate: endDate || null,
            createdBy: userId,
        });

        emitToRoom(connectRequestId, "goal_created", { goal });

        return { goal: toGoalDTO(goal) };
    };

    /**
     * Resolves timeline goals combined with their dependent sequential milestones collections.
     * * @async
     * @function getGoal
     * @param {string} connectRequestId - Core lookup index target key.
     * @param {any} userId - Secure parsing verification validation signature key tracking ownership.
     * @throws {AppError} 403 - If caller identities fail parameter check checks.
     * @throws {AppError} 404 - If structural parent models drop queries completely empty.
     * @returns {Promise<{goal: Object|null, milestones: Array}>} Progress maps layout details.
     */
    const getGoal = async (connectRequestId, userId) => {
        const session = await goalRepo.findSessionById(connectRequestId);
        if (!session) {
            throw new AppError(404, "Session not found");
        }

        if (!assertParticipant(session, userId)) {
            throw new AppError(403, "Not authorized");
        }

        const goal = await goalRepo.findGoalBySession(connectRequestId);
        if (!goal) {
            return { goal: null, milestones: [] };
        }

        const milestones = await goalRepo.findMilestonesByGoal(goal._id);

        return { goal: toGoalDTO(goal), milestones: milestones.map(toMilestoneDTO) };
    };

    /**
     * Updates descriptive field properties or logs lifecycle progress updates onto an existing Goal document.
     * * @async
     * @function updateGoal
     * @param {string} goalId - Primary database entry unique lookup index key.
     * @param {Object} body - Delta properties payload map context.
     * @param {string} [body.title] - Literal label specification updating parameters.
     * @param {string} [body.description] - Description variable updating variables text.
     * @param {string|Date} [body.startDate] - Bounding opening interval calendar metric.
     * @param {string|Date} [body.endDate] - Bounding closing interval calendar metric.
     * @param {string} [body.status] - Tracked status values matching enum configurations.
     * @param {any} userId - Authenticated user credential validation key check parameters.
     * @throws {AppError} 400 - If literal labels are cleared or status values violate enum boundaries.
     * @throws {AppError} 403 - If relationship checks fail.
     * @throws {AppError} 404 - If database query resolves empty properties parameters.
     * @returns {Promise<{goal: Object}>} Freshly mutated goal record DTO parameters data.
     */
    const updateGoal = async (goalId, body, userId) => {
        const goal = await goalRepo.findGoalById(goalId);
        if (!goal) {
            throw new AppError(404, "Goal not found");
        }

        const session = await goalRepo.findSessionById(goal.connectRequest);
        if (!assertParticipant(session, userId)) {
            throw new AppError(403, "Not authorized");
        }

        const { title, description, startDate, endDate, status } = body;

        if (title !== undefined) {
            if (!title.trim()) {
                throw new AppError(400, "title cannot be empty");
            }
            goal.title = title.trim();
        }
        if (description !== undefined) goal.description = description.trim();
        if (startDate !== undefined) goal.startDate = startDate || null;
        if (endDate !== undefined) goal.endDate = endDate || null;
        if (status !== undefined) {
            if (!VALID_GOAL_STATUSES.includes(status)) {
                throw new AppError(400, "Invalid status");
            }
            goal.status = status;
        }

        await goal.save();

        emitToRoom(goal.connectRequest, "goal_updated", { goal });

        return { goal: toGoalDTO(goal) };
    };

    /**
     * Dynamically appends a sequential progress tracking node under a parent milestone roadmap.
     * * @async
     * @function addMilestone
     * @param {string} goalId - Target parent goal identifier index key string.
     * @param {Object} body - Input metrics context parameters data payload.
     * @param {string} body.title - Node title label identifier string value.
     * @param {string} [body.description] - Literal description message text parameters data.
     * @param {string|Date} [body.dueDate] - Calendar cutoff parameter string context.
     * @param {any} userId - Operating token validation tracking parameter key checking credentials.
     * @throws {AppError} 400 - If metric parameters text inputs are empty or malformed.
     * @throws {AppError} 403 - If identity bounds checks reveal mismatch flags.
     * @throws {AppError} 404 - If target lookup parent items return empty documents.
     * @returns {Promise<{milestone: Object}>} Formatted milestone node data transfer structure payload.
     */
    const addMilestone = async (goalId, body, userId) => {
        const goal = await goalRepo.findGoalByIdLean(goalId);
        if (!goal) {
            throw new AppError(404, "Goal not found");
        }

        const session = await goalRepo.findSessionById(goal.connectRequest);
        if (!assertParticipant(session, userId)) {
            throw new AppError(403, "Not authorized");
        }

        const { title, description, dueDate } = body;
        if (!title.trim()) {
            throw new AppError(400, "title cannot be empty");
        }

        const lastMilestone = await goalRepo.findLastMilestone(goal._id);
        const order = lastMilestone ? lastMilestone.order + 1 : 0;

        const milestone = await goalRepo.createMilestone({
            goal: goal._id,
            connectRequest: goal.connectRequest,
            title: title.trim(),
            description: description?.trim() || "",
            dueDate: dueDate || null,
            order,
        });

        emitToRoom(goal.connectRequest, "milestone_added", { milestone });

        return { milestone: toMilestoneDTO(milestone) };
    };

    /**
     * Modifies parameters or appends verification metrics on a specific active tracking milestone node.
     * * @async
     * @function updateMilestone
     * @param {string} milestoneId - Target unique entry primary index locator key string.
     * @param {Object} body - Delta properties criteria configuration data packaging.
     * @param {string} [body.title] - Replacement text labeling criteria items.
     * @param {string} [body.description] - Replacement descriptive message criteria details.
     * @param {boolean} [body.isCompleted] - Resolution completion confirmation tracking flag.
     * @param {any} userId - Execution context credentials verification indicator pointer.
     * @throws {AppError} 400 - If literal parameters titles are cleared into empty spaces.
     * @throws {AppError} 403 - If identity checks fail basic parameter restrictions checks.
     * @throws {AppError} 404 - If data record queries return completely empty responses.
     * @returns {Promise<{milestone: Object}>} Newly written data transfer mapping layout.
     */
    const updateMilestone = async (milestoneId, body, userId) => {
        const milestone = await goalRepo.findMilestoneById(milestoneId);
        if (!milestone) {
            throw new AppError(404, "Milestone not found");
        }

        const session = await goalRepo.findSessionById(milestone.connectRequest);
        if (!assertParticipant(session, userId)) {
            throw new AppError(403, "Not authorized");
        }

        const { title, description, isCompleted } = body;

        if (title !== undefined) {
            if (!title.trim()) {
                throw new AppError(400, "title cannot be empty");
            }
            milestone.title = title.trim();
        }
        if (description !== undefined) milestone.description = description.trim();

        if (isCompleted !== undefined) {
            milestone.isCompleted = isCompleted;
            milestone.completedAt = isCompleted ? new Date() : null;
            milestone.completedBy = isCompleted ? userId : null;
        }

        await milestone.save();

        emitToRoom(milestone.connectRequest, "milestone_updated", { milestone });

        return { milestone: toMilestoneDTO(milestone) };
    };

    /**
     * Erases a targeted progress node item record completely from structural timelines.
     * * @async
     * @function deleteMilestone
     * @param {string} milestoneId - Target primary database unique indicator locator string.
     * @param {any} userId - Security identity context validation checker parameter index.
     * @throws {AppError} 403 - If relationship bounds checking validations drop criteria.
     * @throws {AppError} 404 - If database query targets reveal unresolvable metrics.
     * @returns {Promise<{message: string}>} Basic textual confirmation resolution messaging.
     */
    const deleteMilestone = async (milestoneId, userId) => {
        const milestone = await goalRepo.findMilestoneById(milestoneId);
        if (!milestone) {
            throw new AppError(404, "Milestone not found");
        }

        const session = await goalRepo.findSessionById(milestone.connectRequest);
        if (!assertParticipant(session, userId)) {
            throw new AppError(403, "Not authorized");
        }

        const connectRequestId = milestone.connectRequest;
        const milestoneIds = milestone._id.toString();

        await goalRepo.deleteMilestoneById(milestoneId);

        emitToRoom(connectRequestId, "milestone_deleted", { milestoneIds });

        return { message: "Milestone deleted" };
    };

    return { createGoal, getGoal, updateGoal, addMilestone, updateMilestone, deleteMilestone };
};

module.exports = createGoalService;