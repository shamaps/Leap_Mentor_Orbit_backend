// services/goal.service.js
const goalRepo = require("../repositories/goal.repository");
const socketHandler = require("../socket/socketHandler");
const { VALID_GOAL_STATUSES } = require("../config/constants");

const { logger } = require("@sentry/node");
// ── Socket helper ─────────────────────────────────────────────
const emitToRoom = (connectRequestId, event, data) => {
    try {
        if (socketHandler.io) {
            socketHandler.io.to(connectRequestId.toString()).emit(event, data);
        }
    } catch (err) {
        logger.error("❌ Socket emit error:", err.message);
    }
};

// ── Auth guard helper ─────────────────────────────────────────
const assertParticipant = (session, userId) => {
    const uid = userId.toString();
    return (
        session.mentor.toString() === uid ||
        session.mentee.toString() === uid
    );
};

// ─────────────────────────────────────────────────────────────
// POST /api/goals
// ─────────────────────────────────────────────────────────────
const createGoal = async (body, userId) => {
    const { connectRequestId, title, description, startDate, endDate } = body;

    if (!connectRequestId) {
        const err = new Error("connectRequestId is required");
        err.statusCode = 400;
        throw err;
    }
    if (!title?.trim()) {
        const err = new Error("title is required");
        err.statusCode = 400;
        throw err;
    }

    const session = await goalRepo.findSessionById(connectRequestId);
    if (!session) {
        const err = new Error("Session not found");
        err.statusCode = 404;
        throw err;
    }
    if (session.status !== "ongoing") {
        const err = new Error("Goals can only be set for ongoing sessions");
        err.statusCode = 400;
        throw err;
    }
    if (!assertParticipant(session, userId)) {
        const err = new Error("Not authorized");
        err.statusCode = 403;
        throw err;
    }

    const existing = await goalRepo.findGoalBySession(connectRequestId);
    if (existing) {
        const err = new Error("A goal already exists for this session");
        err.statusCode = 409;
        throw err;
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

    return { goal };
};

// ─────────────────────────────────────────────────────────────
// GET /api/goals/:connectRequestId
// ─────────────────────────────────────────────────────────────
const getGoal = async (connectRequestId, userId) => {
    const session = await goalRepo.findSessionById(connectRequestId);
    if (!session) {
        const err = new Error("Session not found");
        err.statusCode = 404;
        throw err;
    }
    if (!assertParticipant(session, userId)) {
        const err = new Error("Not authorized");
        err.statusCode = 403;
        throw err;
    }

    const goal = await goalRepo.findGoalBySession(connectRequestId);
    if (!goal) {
        return { goal: null, milestones: [] };
    }

    const milestones = await goalRepo.findMilestonesByGoal(goal._id);

    return { goal, milestones };
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/goals/:goalId
// ─────────────────────────────────────────────────────────────
const updateGoal = async (goalId, body, userId) => {
    const goal = await goalRepo.findGoalById(goalId);
    if (!goal) {
        const err = new Error("Goal not found");
        err.statusCode = 404;
        throw err;
    }

    const session = await goalRepo.findSessionById(goal.connectRequest);
    if (!assertParticipant(session, userId)) {
        const err = new Error("Not authorized");
        err.statusCode = 403;
        throw err;
    }

    const { title, description, startDate, endDate, status } = body;

    if (title !== undefined) {
        if (!title.trim()) {
            const err = new Error("title cannot be empty");
            err.statusCode = 400;
            throw err;
        }
        goal.title = title.trim();
    }
    if (description !== undefined) goal.description = description.trim();
    if (startDate !== undefined) goal.startDate = startDate || null;
    if (endDate !== undefined) goal.endDate = endDate || null;
    if (status !== undefined) {
        if (!VALID_GOAL_STATUSES.includes(status)) {
            const err = new Error("Invalid status");
            err.statusCode = 400;
            throw err;
        }
        goal.status = status;
    }

    await goal.save();

    emitToRoom(goal.connectRequest, "goal_updated", { goal });

    return { goal };
};

// ─────────────────────────────────────────────────────────────
// POST /api/goals/:goalId/milestones
// ─────────────────────────────────────────────────────────────
const addMilestone = async (goalId, body, userId) => {
    const goal = await goalRepo.findGoalByIdLean(goalId);
    if (!goal) {
        const err = new Error("Goal not found");
        err.statusCode = 404;
        throw err;
    }

    const session = await goalRepo.findSessionById(goal.connectRequest);
    if (!assertParticipant(session, userId)) {
        const err = new Error("Not authorized");
        err.statusCode = 403;
        throw err;
    }

    const { title, description, dueDate } = body;
    if (!title?.trim()) {
        const err = new Error("title is required");
        err.statusCode = 400;
        throw err;
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

    return { milestone };
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/milestones/:milestoneId
// ─────────────────────────────────────────────────────────────
const updateMilestone = async (milestoneId, body, userId) => {
    const milestone = await goalRepo.findMilestoneById(milestoneId);
    if (!milestone) {
        const err = new Error("Milestone not found");
        err.statusCode = 404;
        throw err;
    }

    const session = await goalRepo.findSessionById(milestone.connectRequest);
    if (!assertParticipant(session, userId)) {
        const err = new Error("Not authorized");
        err.statusCode = 403;
        throw err;
    }

    const { title, description, isCompleted } = body;

    if (title !== undefined) {
        if (!title.trim()) {
            const err = new Error("title cannot be empty");
            err.statusCode = 400;
            throw err;
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

    return { milestone };
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/milestones/:milestoneId
// ─────────────────────────────────────────────────────────────
const deleteMilestone = async (milestoneId, userId) => {
    const milestone = await goalRepo.findMilestoneById(milestoneId);
    if (!milestone) {
        const err = new Error("Milestone not found");
        err.statusCode = 404;
        throw err;
    }

    const session = await goalRepo.findSessionById(milestone.connectRequest);
    if (!assertParticipant(session, userId)) {
        const err = new Error("Not authorized");
        err.statusCode = 403;
        throw err;
    }

    const connectRequestId = milestone.connectRequest;
    const milestoneIdStr = milestone._id.toString();

    await goalRepo.deleteMilestoneById(milestoneId);

    emitToRoom(connectRequestId, "milestone_deleted", { milestoneId: milestoneIdStr });

    return { message: "Milestone deleted" };
};

module.exports = {
    createGoal,
    getGoal,
    updateGoal,
    addMilestone,
    updateMilestone,
    deleteMilestone,
};