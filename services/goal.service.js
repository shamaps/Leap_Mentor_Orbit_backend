// services/goal.service.js
const socketHandler = require("../socket/socketHandler");
const { VALID_GOAL_STATUSES } = require("../config/constants");
const AppError = require("../utils/appError");
const { toGoalDTO, toMilestoneDTO } = require("../utils/mappers/goal.mapper");
const createGoalService = (goalRepo, { logger }) => {
    //  Socket helper 
    const emitToRoom = (connectRequestId, event, data) => {
        try {
            if (socketHandler.io) {
                socketHandler.io.to(connectRequestId.toString()).emit(event, data);
            }
        } catch (err) {
            logger.warn("Socket emit failed", { error: err.message });
        }
    };

    // Auth guard helper
    const assertParticipant = (session, userId) => {
        const uid = userId.toString();
        return (
            session.mentor.toString() === uid ||
            session.mentee.toString() === uid
        );
    };


    // POST /api/goals

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


    // GET /api/goals/:connectRequestId

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


    // PATCH /api/goals/:goalId

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


    // POST /api/goals/:goalId/milestones

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


    // PATCH /api/milestones/:milestoneId

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


    // DELETE /api/milestones/:milestoneId

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