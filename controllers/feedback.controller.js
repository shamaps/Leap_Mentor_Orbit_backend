// backend/controllers/feedback.controller.js
const Feedback = require("../models/Feedback");
const ConnectRequest = require("../models/ConnectRequest");

// ── Auth helper ───────────────────────────────────────────────
const getParticipantRole = (connectRequest, userId) => {
  const uid = userId.toString();
  if (connectRequest.mentor.toString() === uid) return "mentor";
  if (connectRequest.mentee.toString() === uid) return "mentee";
  return null;
};

// ─────────────────────────────────────────────────────────────
// POST /api/feedback
// ─────────────────────────────────────────────────────────────
const submitFeedback = async (req, res) => {
  try {
    const { connectRequestId, rating, comment } = req.body;
    const slotIndex = req.body.slotIndex !== undefined ? Number(req.body.slotIndex) : undefined;
    const userId = req.user._id;

    console.log("feedback body received:", { connectRequestId, rating, comment, slotIndex });

    if (!connectRequestId) {
      return res.status(400).json({ message: "connectRequestId is required" });
    }
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "rating must be between 1 and 5" });
    }

    const connectRequest = await ConnectRequest.findById(connectRequestId)
      .select("mentor mentee status selectedSlots")
      .lean();

    if (!connectRequest) {
      return res.status(404).json({ message: "Session not found" });
    }

    console.log("slot at index", slotIndex, ":", connectRequest.selectedSlots?.[slotIndex]);
    console.log("all slots:", connectRequest.selectedSlots?.map((s, i) => ({
      i,
      menteeMarked: s.menteeMarked,
      mentorMarked: s.mentorMarked,
      status: s.status,
    })));

    // Derive role first
    const fromRole = getParticipantRole(connectRequest, userId);
    if (!fromRole) {
      return res.status(403).json({ message: "Not authorized to submit feedback for this session" });
    }

    // Validate: if slotIndex given, check only THIS user's mark on that slot
    if (slotIndex !== undefined && slotIndex !== null) {
      const slot = connectRequest.selectedSlots?.[slotIndex];
      const myMark = fromRole === "mentee" ? slot?.menteeMarked : slot?.mentorMarked;

      console.log("fromRole:", fromRole, "myMark:", myMark, "slot:", slot);

      if (!slot || !myMark) {
        return res.status(400).json({
          message: "Feedback can only be submitted for completed sessions",
        });
      }
    } else if (connectRequest.status !== "completed") {
      return res.status(400).json({
        message: "Feedback can only be submitted for completed sessions",
      });
    }

    const toUserId = fromRole === "mentor"
      ? connectRequest.mentee
      : connectRequest.mentor;

    //  Check for duplicate — per slot if slotIndex provided
    const duplicateQuery = {
      connectRequest: connectRequestId,
      from: userId,
      ...(slotIndex !== undefined && slotIndex !== null ? { slotIndex } : {}),
    };
    const existing = await Feedback.findOne(duplicateQuery);
    if (existing) {
      return res.status(409).json({ message: "You have already submitted feedback for this session" });
    }

    const feedback = await Feedback.create({
      connectRequest: connectRequestId,
      from: userId,
      to: toUserId,
      fromRole,
      rating,
      comment: comment?.trim() || "",
      ...(slotIndex !== undefined && slotIndex !== null ? { slotIndex } : {}),
    });

    // Auto-update mentor avgRating when mentee submits feedback
    if (fromRole === "mentee") {
      const MentorProfile = require("../models/MentorProfile");
      const allMentorFeedback = await Feedback.find({ to: toUserId }).lean();
      const totalRatings = allMentorFeedback.reduce((sum, f) => sum + f.rating, 0);
      const newAvgRating = parseFloat(
        (totalRatings / allMentorFeedback.length).toFixed(1)
      );
      await MentorProfile.findOneAndUpdate(
        { user: toUserId },
        { $set: { avgRating: newAvgRating } }
      );
      console.log(`⭐ Updated avgRating for mentor: ${newAvgRating}`);
    }

    const populated = await Feedback.findById(feedback._id)
      .populate("from", "name email")
      .populate("to", "name email")
      .lean();

    return res.status(201).json({ success: true, feedback: populated });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "You have already submitted feedback for this session" });
    }
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/feedback/:connectRequestId
// ─────────────────────────────────────────────────────────────
const getFeedback = async (req, res) => {
  try {
    const { connectRequestId } = req.params;
    const userId = req.user._id.toString();

    const connectRequest = await ConnectRequest.findById(connectRequestId)
      .select("mentor mentee status")
      .lean();

    if (!connectRequest) {
      return res.status(404).json({ message: "Session not found" });
    }

    const role = getParticipantRole(connectRequest, userId);
    if (!role) {
      return res.status(403).json({ message: "Not authorized to view this session's feedback" });
    }

    const allFeedback = await Feedback.find({ connectRequest: connectRequestId })
      .populate("from", "name email")
      .lean();

    const myFeedback = allFeedback.find((f) => f.from._id.toString() === userId) || null;
    const theirFeedback = allFeedback.find((f) => f.from._id.toString() !== userId) || null;

    return res.json({
      success: true,
      myFeedback,
      theirFeedback: connectRequest.status === "completed" ? theirFeedback : null,
      sessionStatus: connectRequest.status,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { submitFeedback, getFeedback };