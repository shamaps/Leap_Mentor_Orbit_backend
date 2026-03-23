// backend/controllers/connectRequest.controller.js
const mongoose = require("mongoose");
const ConnectRequest = require("../models/ConnectRequest");
const MentorProfile = require("../models/MentorProfile");
const createNotification = require("../utils/createNotification");
const {
  sendConnectRequestEmail,
  sendRequestAcceptedEmail,
} = require("../utils/sendNotificationEmail");

// Import emitToUser — available after socketHandler initializes
const getEmitToUser = () => require("../socket/socketHandler").emitToUser;

/**
 * POST /api/connect-requests
 * Mentee sends a connect request with multiple proposed slots
 */
const sendConnectRequest = async (req, res) => {
  try {
    const { mentorId, message, selectedSlots, sessionRate, sessionCount } = req.body;
    const menteeId = req.user._id;

    if (!mentorId)
      return res.status(400).json({ message: "mentorId is required" });

    if (!Array.isArray(selectedSlots) || selectedSlots.length === 0)
      return res.status(400).json({ message: "At least one slot must be selected" });

    if (selectedSlots.length > 5)
      return res.status(400).json({ message: "Maximum 5 slots can be proposed" });

    for (const slot of selectedSlots) {
      if (!slot.day || !slot.date || !slot.startTime || !slot.endTime)
        return res.status(400).json({ message: "Each slot must have day, date, startTime and endTime" });
    }

    if (menteeId.toString() === mentorId)
      return res.status(400).json({ message: "You cannot send a request to yourself" });

    const existingPending = await ConnectRequest.findOne({
      mentee: menteeId,
      mentor: mentorId,
      status: "pending",
    });
    if (existingPending)
      return res.status(409).json({ message: "You already have a pending request with this mentor" });

    for (const slot of selectedSlots) {
      const slotTaken = await ConnectRequest.findOne({
        mentor: mentorId,
        status: { $in: ["pending", "accepted"] },
        "selectedSlots.date": slot.date,
        "selectedSlots.startTime": slot.startTime,
        "selectedSlots.endTime": slot.endTime,
      });
      if (slotTaken)
        return res.status(409).json({
          message: `Slot ${slot.date} ${slot.startTime}–${slot.endTime} is already taken. Please choose another.`,
        });
    }

    if (sessionRate && Number(sessionRate) < 1)
      return res.status(400).json({ message: "sessionRate must be at least 1" });
    if (sessionCount && Number(sessionCount) < 1)
      return res.status(400).json({ message: "sessionCount must be at least 1" });

    const request = await ConnectRequest.create({
      mentee: menteeId,
      mentor: mentorId,
      message: message?.trim() || "",
      selectedSlots,
      requestedAt: new Date(),
      sessionRate: sessionRate ? Number(sessionRate) : null,
      sessionCount: sessionCount ? Number(sessionCount) : null,
      totalAmount: sessionRate && sessionCount
        ? Number(sessionRate) * Number(sessionCount)
        : null,
    });

    // ── Populate mentor for email ─────────────────────────────
    await request.populate("mentor", "name email");

    const mentorUserId = new mongoose.Types.ObjectId(mentorId);

    await createNotification({
      recipient: mentorUserId,
      type: "connect_request_received",
      title: "New Connect Request",
      message: `You have a new connect request from a mentee.`,
      metadata: { requestId: request._id, menteeId: menteeId },
    });

    // ── Emit real-time toast to mentor if online ──────────────
    const emitToUser = getEmitToUser();
    if (emitToUser) {
      emitToUser(mentorId, "new_connect_request", {
        title: "New Connect Request 🔔",
        message: `${req.user.name} sent you a connect request.`,
        type: "info",
      });

      // ✅ Tell mentor's dashboard to refetch incoming requests list
      emitToUser(mentorId, "request_status_changed", {
        requestId: request._id.toString(),
        status: "pending",
      });
    }

    // ── Notify mentor via email (non-blocking) ────────────────
    sendConnectRequestEmail({
      mentorName: request.mentor?.name || "Mentor",
      mentorEmail: request.mentor?.email,
      menteeName: req.user.name,
      slots: selectedSlots,
      message: message?.trim() || "",
    }).catch((err) => console.error("❌ Connect request email failed:", err.message));

    return res.status(201).json({
      message: "Connect request sent successfully",
      request,
    });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ message: "You already have a pending request with this mentor" });
    return res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/connect-requests/my-requests
 * Mentee views all their sent requests — enriched with mentor profile
 */
const getMyRequests = async (req, res) => {
  try {
    const requests = await ConnectRequest.find({ mentee: req.user._id })
      .populate("mentor", "name email")
      .populate("referredTo", "name email")
      .sort({ requestedAt: -1 })
      .lean();

    const enriched = await Promise.all(
      requests.map(async (r) => {
        const mentorProfile = await MentorProfile.findOne({ user: r.mentor?._id })
          .select("currentRole company profilePicture avgRating skills hourlyRate")
          .lean();

        const referredToProfile = r.referredTo
          ? await MentorProfile.findOne({ user: r.referredTo?._id })
            .select("currentRole company industry bio hourlyRate avgRating yearsOfExperience profilePicture skills")
            .lean()
          : null;

        return {
          ...r,
          mentorProfile: mentorProfile || null,
          referredToProfile: referredToProfile || null,
        };
      })
    );

    return res.json({ success: true, requests: enriched });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/connect-requests/incoming
 * Mentor views all incoming requests
 */
const getIncomingRequests = async (req, res) => {
  try {
    const { status } = req.query;

    const filter = { mentor: req.user._id };
    if (status && ["pending", "accepted", "rejected", "referred"].includes(status)) {
      filter.status = status;
    }

    const requests = await ConnectRequest.find(filter)
      .populate("mentee", "name email")
      .populate("referredBy", "name email")
      .sort({ requestedAt: -1 })
      .lean();

    const enriched = await Promise.all(
      requests.map(async (r) => {
        const referredByProfile = r.referredBy
          ? await MentorProfile.findOne({ user: r.referredBy._id })
            .select("currentRole company industry bio hourlyRate avgRating yearsOfExperience profilePicture skills")
            .lean()
          : null;

        return {
          ...r,
          referredByProfile: referredByProfile || null,
        };
      })
    );

    return res.json({ success: true, requests: enriched });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/connect-requests/:id
 * Mentor accepts or rejects a request
 */
const respondToRequest = async (req, res) => {
  try {
    const { status, confirmedSlot } = req.body;

    if (!["accepted", "rejected"].includes(status))
      return res.status(400).json({ message: "Status must be 'accepted' or 'rejected'" });

    if (status === "accepted") {
      if (!confirmedSlot?.date || !confirmedSlot?.startTime || !confirmedSlot?.endTime)
        return res.status(400).json({ message: "confirmedSlot is required when accepting" });
    }

    const request = await ConnectRequest.findById(req.params.id)
      .populate("mentee", "name email")
      .populate("mentor", "name email");

    if (!request)
      return res.status(404).json({ message: "Request not found" });

    if (request.mentor._id.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorized to respond to this request" });

    if (request.status !== "pending")
      return res.status(400).json({ message: `Request already ${request.status}` });

    request.status = status;
    request.respondedAt = new Date();
    if (status === "accepted") request.confirmedSlot = confirmedSlot;
    await request.save();

    const emitToUser = getEmitToUser();

    // ✅ Tell BOTH dashboards to refetch their requests lists in real-time
    if (emitToUser) {
      emitToUser(request.mentee._id.toString(), "request_status_changed", {
        requestId: request._id.toString(),
        status,
      });
      emitToUser(request.mentor._id.toString(), "request_status_changed", {
        requestId: request._id.toString(),
        status,
      });
    }

    if (status === "accepted") {
      await createNotification({
        recipient: request.mentee._id,
        type: "connect_request_accepted",
        title: "Connect Request Accepted! 🎉",
        message: `${request.mentor.name} has accepted your connect request. Your session is confirmed on ${confirmedSlot.date} at ${confirmedSlot.startTime}.`,
        metadata: { requestId: request._id, mentorId: request.mentor._id },
      });

      // ── Emit real-time toast to mentee ────────────────────
      if (emitToUser) {
        emitToUser(request.mentee._id.toString(), "request_accepted", {
          title: "Request Accepted! 🎉",
          message: `${request.mentor.name} accepted your connect request.`,
          type: "success",
        });
      }

      await ConnectRequest.updateMany(
        {
          _id: { $ne: request._id },
          mentor: request.mentor._id,
          status: "pending",
          "selectedSlots.date": confirmedSlot.date,
          "selectedSlots.startTime": confirmedSlot.startTime,
          "selectedSlots.endTime": confirmedSlot.endTime,
        },
        { $set: { status: "rejected", respondedAt: new Date() } }
      );

      // ── Notify mentee via email (non-blocking) ────────────
      sendRequestAcceptedEmail({
        menteeName: request.mentee.name,
        menteeEmail: request.mentee.email,
        mentorName: request.mentor.name,
        confirmedSlot,
        slots: request.selectedSlots,
      }).catch((err) => console.error("❌ Request accepted email failed:", err.message));
    }

    if (status === "rejected") {
      await createNotification({
        recipient: request.mentee._id,
        type: "connect_request_declined",
        title: "Connect Request Declined",
        message: `${request.mentor.name} was unable to accept your connect request at this time.`,
        metadata: { requestId: request._id, mentorId: request.mentor._id },
      });

      // ── Emit real-time toast to mentee ────────────────────
      if (emitToUser) {
        emitToUser(request.mentee._id.toString(), "request_declined", {
          title: "Request Declined",
          message: `${request.mentor.name} was unable to accept your request at this time.`,
          type: "warning",
        });
      }
    }

    return res.json({ message: `Request ${status} successfully`, request });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /api/connect-requests/:id
 * Mentee cancels a pending request
 */
const cancelRequest = async (req, res) => {
  try {
    const request = await ConnectRequest.findById(req.params.id);

    if (!request)
      return res.status(404).json({ message: "Request not found" });

    if (request.mentee.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorized to cancel this request" });

    if (request.status === "ongoing")
      return res.status(400).json({ message: "Cannot delete an ongoing session" });

    await ConnectRequest.findByIdAndDelete(req.params.id);
    return res.json({ message: "Request cancelled successfully" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/connect-requests/:id/refer
 * Mentor refers a request to another mentor with similar skills
 */
const referRequest = async (req, res) => {
  try {
    const { referToMentorId } = req.body;

    if (!referToMentorId)
      return res.status(400).json({ message: "referToMentorId is required" });

    const request = await ConnectRequest.findById(req.params.id)
      .populate("mentee", "name email")
      .populate("mentor", "name email");

    if (!request)
      return res.status(404).json({ message: "Request not found" });

    if (request.mentor._id.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorized to refer this request" });

    if (request.status !== "pending")
      return res.status(400).json({ message: `Cannot refer a request that is already ${request.status}` });

    if (referToMentorId === req.user._id.toString())
      return res.status(400).json({ message: "Cannot refer request to yourself" });

    const existingRequest = await ConnectRequest.findOne({
      mentee: request.mentee._id,
      mentor: referToMentorId,
      status: "pending",
    });
    if (existingRequest)
      return res.status(409).json({ message: "Mentee already has a pending request with this mentor" });

    const newRequest = await ConnectRequest.create({
      mentee: request.mentee._id,
      mentor: referToMentorId,
      message: request.message,
      selectedSlots: request.selectedSlots,
      requestedAt: new Date(),
      referredBy: req.user._id,
    });

    await createNotification({
      recipient: new mongoose.Types.ObjectId(referToMentorId),
      type: "connect_request_received",
      title: "New Connect Request (Referred)",
      message: `You have received a referred connect request from ${request.mentee.name}.`,
      metadata: { requestId: newRequest._id, menteeId: request.mentee._id },
    });

    await createNotification({
      recipient: request.mentee._id,
      type: "connect_request_declined",
      title: "Request Referred to Another Mentor",
      message: `${request.mentor.name} has referred your request to another mentor who may be a better fit.`,
      metadata: { requestId: request._id, mentorId: request.mentor._id },
    });

    const emitToUser = getEmitToUser();
    if (emitToUser) {
      emitToUser(request.mentee._id.toString(), "request_referred", {
        title: "Request Referred",
        message: `${request.mentor.name} referred your request to another mentor.`,
        type: "info",
      });
      emitToUser(referToMentorId, "new_connect_request", {
        title: "New Connect Request (Referred) 🔔",
        message: `${request.mentee.name} was referred to you by ${request.mentor.name}.`,
        type: "info",
      });

      // ✅ Tell mentee's dashboard to refetch — request is now referred
      emitToUser(request.mentee._id.toString(), "request_status_changed", {
        requestId: request._id.toString(),
        status: "referred",
      });

      // ✅ Tell new mentor's dashboard to refetch — they have a new request
      emitToUser(referToMentorId, "request_status_changed", {
        requestId: newRequest._id.toString(),
        status: "pending",
      });
    }

    request.status = "referred";
    request.referredTo = referToMentorId;
    request.referredRequestId = newRequest._id;
    request.respondedAt = new Date();
    await request.save();

    return res.json({
      message: "Request referred successfully",
      originalRequest: request,
      newRequest,
    });
  } catch (err) {
    console.error("❌ Refer request error:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/connect-requests/ongoing
 */
const getOngoingConnects = async (req, res) => {
  try {
    const MenteeProfile = require("../models/MenteeProfile");
    const userId = req.user._id;

    const requests = await ConnectRequest.find({
      status: { $in: ["ongoing", "completed"] },
      $or: [{ mentee: userId }, { mentor: userId }],
    })
      .populate("mentee", "name email")
      .populate("mentor", "name email")
      .sort({ paidAt: -1 })
      .lean();

    const enriched = await Promise.all(
      requests.map(async (r) => {
        const isMentee = r.mentee._id.toString() === userId.toString();
        if (isMentee) {
          const mentorProfile = await MentorProfile.findOne({ user: r.mentor._id })
            .select("currentRole company profilePicture skills hourlyRate avgRating bio")
            .lean();
          return { ...r, mentorProfile: mentorProfile || null };
        } else {
          const menteeProfile = await MenteeProfile.findOne({ user: r.mentee._id })
            .select("currentRole company profilePicture skills bio interestedFields")
            .lean();
          return { ...r, menteeProfile: menteeProfile || null };
        }
      })
    );

    return res.json({ success: true, connects: enriched });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/connect-requests/:id/detail
 */
const getConnectDetail = async (req, res) => {
  try {
    const MenteeProfile = require("../models/MenteeProfile");

    const request = await ConnectRequest.findById(req.params.id)
      .populate("mentee", "name email")
      .populate("mentor", "name email")
      .lean();

    if (!request)
      return res.status(404).json({ message: "Session not found" });

    const userId = req.user._id.toString();
    const isMentee = request.mentee._id.toString() === userId;
    const isMentor = request.mentor._id.toString() === userId;

    if (!isMentee && !isMentor)
      return res.status(403).json({ message: "Not authorized to view this session" });

    const [mentorProfile, menteeProfile] = await Promise.all([
      MentorProfile.findOne({ user: request.mentor._id })
        .select("currentRole company profilePicture skills hourlyRate avgRating bio")
        .lean(),
      MenteeProfile.findOne({ user: request.mentee._id })
        .select("currentRole company profilePicture skills bio interestedFields")
        .lean(),
    ]);

    return res.json({
      success: true,
      connect: {
        ...request,
        mentorProfile: mentorProfile || null,
        menteeProfile: menteeProfile || null,
        viewerRole: isMentee ? "mentee" : "mentor",
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  sendConnectRequest,
  getMyRequests,
  getIncomingRequests,
  respondToRequest,
  cancelRequest,
  referRequest,
  getOngoingConnects,
  getConnectDetail,
};