// backend/controllers/goal.controller.js
const Goal = require("../models/Goal");
const Milestone = require("../models/Milestone");
const ConnectRequest = require("../models/ConnectRequest");

// ✅ Import socketHandler to emit real-time events to the room
const socketHandler = require("../socket/socketHandler");

// ── Helper: emit to the room (both mentor + mentee) ──────────
const emitToRoom = (connectRequestId, event, data) => {
  try {
    if (socketHandler.io) {
      socketHandler.io.to(connectRequestId.toString()).emit(event, data);
    }
  } catch (err) {
    console.error("❌ Socket emit error:", err.message);
  }
};

// ── Auth guard helper ─────────────────────────────────────────
const assertParticipant = (connectRequest, userId) => {
  const mentorId = connectRequest.mentor.toString();
  const menteeId = connectRequest.mentee.toString();
  const uid = userId.toString();
  return uid === mentorId || uid === menteeId;
};

// ─────────────────────────────────────────────────────────────
// POST /api/goals
// ─────────────────────────────────────────────────────────────
const createGoal = async (req, res) => {
  try {
    const { connectRequestId, title, description, startDate, endDate } = req.body;

    if (!connectRequestId) {
      return res.status(400).json({ message: "connectRequestId is required" });
    }
    if (!title?.trim()) {
      return res.status(400).json({ message: "title is required" });
    }

    const session = await ConnectRequest.findById(connectRequestId).lean();
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    if (session.status !== "ongoing") {
      return res.status(400).json({ message: "Goals can only be set for ongoing sessions" });
    }
    if (!assertParticipant(session, req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const existing = await Goal.findOne({ connectRequest: connectRequestId });
    if (existing) {
      return res.status(409).json({ message: "A goal already exists for this session" });
    }

    const goal = await Goal.create({
      connectRequest: connectRequestId,
      mentor: session.mentor,
      mentee: session.mentee,
      title: title.trim(),
      description: description?.trim() || "",
      startDate: startDate || null,
      endDate: endDate || null,
      createdBy: req.user._id,
    });

    // ✅ Push to both mentor and mentee in real-time
    emitToRoom(connectRequestId, "goal_created", { goal });

    return res.status(201).json({ success: true, goal });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/goals/:connectRequestId
// ─────────────────────────────────────────────────────────────
const getGoal = async (req, res) => {
  try {
    const { connectRequestId } = req.params;

    const session = await ConnectRequest.findById(connectRequestId).lean();
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    if (!assertParticipant(session, req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const goal = await Goal.findOne({ connectRequest: connectRequestId }).lean();
    if (!goal) {
      return res.json({ success: true, goal: null, milestones: [] });
    }

    const milestones = await Milestone.find({ goal: goal._id })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    return res.json({ success: true, goal, milestones });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/goals/:goalId
// ─────────────────────────────────────────────────────────────
const updateGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.goalId);
    if (!goal) {
      return res.status(404).json({ message: "Goal not found" });
    }

    const session = await ConnectRequest.findById(goal.connectRequest).lean();
    if (!assertParticipant(session, req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { title, description, startDate, endDate, status } = req.body;

    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ message: "title cannot be empty" });
      goal.title = title.trim();
    }
    if (description !== undefined) goal.description = description.trim();
    if (startDate !== undefined) goal.startDate = startDate || null;
    if (endDate !== undefined) goal.endDate = endDate || null;
    if (status !== undefined) {
      if (!["active", "completed", "abandoned"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      goal.status = status;
    }

    await goal.save();

    // ✅ Push updated goal to both users in real-time
    emitToRoom(goal.connectRequest, "goal_updated", { goal });

    return res.json({ success: true, goal });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/goals/:goalId/milestones
// ─────────────────────────────────────────────────────────────
const addMilestone = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.goalId).lean();
    if (!goal) {
      return res.status(404).json({ message: "Goal not found" });
    }

    const session = await ConnectRequest.findById(goal.connectRequest).lean();
    if (!assertParticipant(session, req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { title, description, dueDate } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ message: "title is required" });
    }

    const lastMilestone = await Milestone.findOne({ goal: goal._id })
      .sort({ order: -1 })
      .lean();
    const order = lastMilestone ? lastMilestone.order + 1 : 0;

    const milestone = await Milestone.create({
      goal: goal._id,
      connectRequest: goal.connectRequest,
      title: title.trim(),
      description: description?.trim() || "",
      dueDate: dueDate || null,
      order,
    });

    // ✅ Push new milestone to both users in real-time
    emitToRoom(goal.connectRequest, "milestone_added", { milestone });

    return res.status(201).json({ success: true, milestone });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/milestones/:milestoneId
// ─────────────────────────────────────────────────────────────
const updateMilestone = async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.milestoneId);
    if (!milestone) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    const session = await ConnectRequest.findById(milestone.connectRequest).lean();
    if (!assertParticipant(session, req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { title, description, isCompleted } = req.body;

    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ message: "title cannot be empty" });
      milestone.title = title.trim();
    }
    if (description !== undefined) milestone.description = description.trim();

    if (isCompleted !== undefined) {
      milestone.isCompleted = isCompleted;
      milestone.completedAt = isCompleted ? new Date() : null;
      milestone.completedBy = isCompleted ? req.user._id : null;
    }

    await milestone.save();

    // ✅ Push updated milestone to both users in real-time
    emitToRoom(milestone.connectRequest, "milestone_updated", { milestone });

    return res.json({ success: true, milestone });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/milestones/:milestoneId
// ─────────────────────────────────────────────────────────────
const deleteMilestone = async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.milestoneId);
    if (!milestone) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    const session = await ConnectRequest.findById(milestone.connectRequest).lean();
    if (!assertParticipant(session, req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const connectRequestId = milestone.connectRequest;
    const milestoneId = milestone._id.toString();

    await Milestone.findByIdAndDelete(req.params.milestoneId);

    // ✅ Push deletion to both users in real-time
    emitToRoom(connectRequestId, "milestone_deleted", { milestoneId });

    return res.json({ success: true, message: "Milestone deleted" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
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