// services/connectRequest.service.js
const mongoose = require("mongoose");
const connectRequestRepository = require("../repositories/connectRequest.repository");
const createNotification        = require("../utils/createNotification");
const {
  sendConnectRequestEmail,
  sendRequestAcceptedEmail,
} = require("../utils/sendNotificationEmail");

const getEmitToUser = () => require("../socket/socketHandler").emitToUser;

// ─────────────────────────────────────────────────────────────
const sendConnectRequest = async (body, currentUser) => {
  const { mentorId, message, selectedSlots, sessionRate, sessionCount } = body;
  const menteeId = currentUser._id;

  if (!mentorId) {
    const err = new Error("mentorId is required"); err.statusCode = 400; throw err;
  }
  if (!Array.isArray(selectedSlots) || selectedSlots.length === 0) {
    const err = new Error("At least one slot must be selected"); err.statusCode = 400; throw err;
  }
  if (selectedSlots.length > 5) {
    const err = new Error("Maximum 5 slots can be proposed"); err.statusCode = 400; throw err;
  }
  for (const slot of selectedSlots) {
    if (!slot.day || !slot.date || !slot.startTime || !slot.endTime) {
      const err = new Error("Each slot must have day, date, startTime and endTime"); err.statusCode = 400; throw err;
    }
  }
  if (menteeId.toString() === mentorId) {
    const err = new Error("You cannot send a request to yourself"); err.statusCode = 400; throw err;
  }

  const existingPending = await connectRequestRepository.findPendingRequest(menteeId, mentorId);
  if (existingPending) {
    const err = new Error("You already have a pending request with this mentor"); err.statusCode = 409; throw err;
  }

  for (const slot of selectedSlots) {
    const slotTaken = await connectRequestRepository.findSlotConflict(mentorId, slot);
    if (slotTaken) {
      const err = new Error(`Slot ${slot.date} ${slot.startTime}–${slot.endTime} is already taken. Please choose another.`);
      err.statusCode = 409; throw err;
    }
  }

  if (sessionRate && Number(sessionRate) < 1) {
    const err = new Error("sessionRate must be at least 1"); err.statusCode = 400; throw err;
  }
  if (sessionCount && Number(sessionCount) < 1) {
    const err = new Error("sessionCount must be at least 1"); err.statusCode = 400; throw err;
  }

  const request = await connectRequestRepository.createConnectRequest({
    mentee:       menteeId,
    mentor:       mentorId,
    message:      message?.trim() || "",
    selectedSlots,
    requestedAt:  new Date(),
    sessionRate:  sessionRate  ? Number(sessionRate)  : null,
    sessionCount: sessionCount ? Number(sessionCount) : null,
    totalAmount:  sessionRate && sessionCount ? Number(sessionRate) * Number(sessionCount) : null,
  });

  await request.populate("mentor", "name email");

  const mentorUserId = new mongoose.Types.ObjectId(mentorId);

  await createNotification({
    recipient: mentorUserId,
    type:      "connect_request_received",
    title:     "New Connect Request",
    message:   `You have a new connect request from a mentee.`,
    metadata:  { requestId: request._id, menteeId },
  });

  const emitToUser = getEmitToUser();
  if (emitToUser) {
    emitToUser(mentorId, "new_connect_request", {
      title:   "New Connect Request 🔔",
      message: `${currentUser.name} sent you a connect request.`,
      type:    "info",
    });
    emitToUser(mentorId, "request_status_changed", {
      requestId: request._id.toString(),
      status:    "pending",
    });
  }

  sendConnectRequestEmail({
    mentorName:  request.mentor?.name || "Mentor",
    mentorEmail: request.mentor?.email,
    menteeName:  currentUser.name,
    slots:       selectedSlots,
    message:     message?.trim() || "",
  }).catch((err) => console.error("❌ Connect request email failed:", err.message));

  return request;
};

// ─────────────────────────────────────────────────────────────
const getMyRequests = async (menteeId) => {
  const requests = await connectRequestRepository.findMyRequests(menteeId);

  return await Promise.all(
    requests.map(async (r) => {
      const mentorProfile = await connectRequestRepository.findMentorProfile(r.mentor?._id);
      const referredToProfile = r.referredTo
        ? await connectRequestRepository.findMentorProfileFull(r.referredTo?._id)
        : null;
      return { ...r, mentorProfile: mentorProfile || null, referredToProfile: referredToProfile || null };
    })
  );
};

// ─────────────────────────────────────────────────────────────
const getIncomingRequests = async (mentorId, status) => {
  const requests = await connectRequestRepository.findIncomingRequests(mentorId, status);

  return await Promise.all(
    requests.map(async (r) => {
      const referredByProfile = r.referredBy
        ? await connectRequestRepository.findMentorProfileFull(r.referredBy._id)
        : null;
      return { ...r, referredByProfile: referredByProfile || null };
    })
  );
};

// ─────────────────────────────────────────────────────────────
const respondToRequest = async (requestId, body, currentUser) => {
  const { status, confirmedSlot } = body;

  if (!["accepted", "rejected"].includes(status)) {
    const err = new Error("Status must be 'accepted' or 'rejected'"); err.statusCode = 400; throw err;
  }
  if (status === "accepted") {
    if (!confirmedSlot?.date || !confirmedSlot?.startTime || !confirmedSlot?.endTime) {
      const err = new Error("confirmedSlot is required when accepting"); err.statusCode = 400; throw err;
    }
  }

  const request = await connectRequestRepository.findRequestByIdWithUsers(requestId);
  if (!request) {
    const err = new Error("Request not found"); err.statusCode = 404; throw err;
  }
  if (request.mentor._id.toString() !== currentUser._id.toString()) {
    const err = new Error("Not authorized to respond to this request"); err.statusCode = 403; throw err;
  }
  if (request.status !== "pending") {
    const err = new Error(`Request already ${request.status}`); err.statusCode = 400; throw err;
  }

  request.status      = status;
  request.respondedAt = new Date();
  if (status === "accepted") request.confirmedSlot = confirmedSlot;
  await connectRequestRepository.saveRequest(request);

  const emitToUser = getEmitToUser();
  if (emitToUser) {
    emitToUser(request.mentee._id.toString(), "request_status_changed", { requestId: request._id.toString(), status });
    emitToUser(request.mentor._id.toString(), "request_status_changed", { requestId: request._id.toString(), status });
  }

  if (status === "accepted") {
    await createNotification({
      recipient: request.mentee._id,
      type:      "connect_request_accepted",
      title:     "Connect Request Accepted! 🎉",
      message:   `${request.mentor.name} has accepted your connect request. Your session is confirmed on ${confirmedSlot.date} at ${confirmedSlot.startTime}.`,
      metadata:  { requestId: request._id, mentorId: request.mentor._id },
    });

    if (emitToUser) {
      emitToUser(request.mentee._id.toString(), "request_accepted", {
        title:   "Request Accepted! 🎉",
        message: `${request.mentor.name} accepted your connect request.`,
        type:    "success",
      });
    }

    await connectRequestRepository.rejectConflictingSlots(request._id, request.mentor._id, confirmedSlot);

    sendRequestAcceptedEmail({
      menteeName:  request.mentee.name,
      menteeEmail: request.mentee.email,
      mentorName:  request.mentor.name,
      confirmedSlot,
      slots:       request.selectedSlots,
    }).catch((err) => console.error("❌ Request accepted email failed:", err.message));
  }

  if (status === "rejected") {
    await createNotification({
      recipient: request.mentee._id,
      type:      "connect_request_declined",
      title:     "Connect Request Declined",
      message:   `${request.mentor.name} was unable to accept your connect request at this time.`,
      metadata:  { requestId: request._id, mentorId: request.mentor._id },
    });

    if (emitToUser) {
      emitToUser(request.mentee._id.toString(), "request_declined", {
        title:   "Request Declined",
        message: `${request.mentor.name} was unable to accept your request at this time.`,
        type:    "warning",
      });
    }
  }

  return request;
};

// ─────────────────────────────────────────────────────────────
const cancelRequest = async (requestId, currentUser) => {
  const request = await connectRequestRepository.findRequestById(requestId);

  if (!request) {
    const err = new Error("Request not found"); err.statusCode = 404; throw err;
  }
  if (request.mentee.toString() !== currentUser._id.toString()) {
    const err = new Error("Not authorized to cancel this request"); err.statusCode = 403; throw err;
  }
  if (request.status === "ongoing") {
    const err = new Error("Cannot delete an ongoing session"); err.statusCode = 400; throw err;
  }

  await connectRequestRepository.deleteRequestById(requestId);
};

// ─────────────────────────────────────────────────────────────
const referRequest = async (requestId, body, currentUser) => {
  const { referToMentorId } = body;

  if (!referToMentorId) {
    const err = new Error("referToMentorId is required"); err.statusCode = 400; throw err;
  }

  const request = await connectRequestRepository.findRequestByIdWithUsers(requestId);
  if (!request) {
    const err = new Error("Request not found"); err.statusCode = 404; throw err;
  }
  if (request.mentor._id.toString() !== currentUser._id.toString()) {
    const err = new Error("Not authorized to refer this request"); err.statusCode = 403; throw err;
  }
  if (request.status !== "pending") {
    const err = new Error(`Cannot refer a request that is already ${request.status}`); err.statusCode = 400; throw err;
  }
  if (referToMentorId === currentUser._id.toString()) {
    const err = new Error("Cannot refer request to yourself"); err.statusCode = 400; throw err;
  }

  const existingRequest = await connectRequestRepository.findExistingReferral(request.mentee._id, referToMentorId);
  if (existingRequest) {
    const err = new Error("Mentee already has a pending request with this mentor"); err.statusCode = 409; throw err;
  }

  const newRequest = await connectRequestRepository.createConnectRequest({
    mentee:        request.mentee._id,
    mentor:        referToMentorId,
    message:       request.message,
    selectedSlots: request.selectedSlots,
    requestedAt:   new Date(),
    referredBy:    currentUser._id,
  });

  await createNotification({
    recipient: new mongoose.Types.ObjectId(referToMentorId),
    type:      "connect_request_received",
    title:     "New Connect Request (Referred)",
    message:   `You have received a referred connect request from ${request.mentee.name}.`,
    metadata:  { requestId: newRequest._id, menteeId: request.mentee._id },
  });

  await createNotification({
    recipient: request.mentee._id,
    type:      "connect_request_declined",
    title:     "Request Referred to Another Mentor",
    message:   `${request.mentor.name} has referred your request to another mentor who may be a better fit.`,
    metadata:  { requestId: request._id, mentorId: request.mentor._id },
  });

  const emitToUser = getEmitToUser();
  if (emitToUser) {
    emitToUser(request.mentee._id.toString(), "request_referred", {
      title:   "Request Referred",
      message: `${request.mentor.name} referred your request to another mentor.`,
      type:    "info",
    });
    emitToUser(referToMentorId, "new_connect_request", {
      title:   "New Connect Request (Referred) 🔔",
      message: `${request.mentee.name} was referred to you by ${request.mentor.name}.`,
      type:    "info",
    });
    emitToUser(request.mentee._id.toString(), "request_status_changed", {
      requestId: request._id.toString(),
      status:    "referred",
    });
    emitToUser(referToMentorId, "request_status_changed", {
      requestId: newRequest._id.toString(),
      status:    "pending",
    });
  }

  request.status            = "referred";
  request.referredTo        = referToMentorId;
  request.referredRequestId = newRequest._id;
  request.respondedAt       = new Date();
  await connectRequestRepository.saveRequest(request);

  return { originalRequest: request, newRequest };
};

// ─────────────────────────────────────────────────────────────
const getOngoingConnects = async (userId) => {
  const requests = await connectRequestRepository.findOngoingConnects(userId);

  return await Promise.all(
    requests.map(async (r) => {
      const isMentee = r.mentee._id.toString() === userId.toString();
      if (isMentee) {
        const mentorProfile = await connectRequestRepository.findMentorProfile(r.mentor._id);
        return { ...r, mentorProfile: mentorProfile || null };
      } else {
        const menteeProfile = await connectRequestRepository.findMenteeProfile(r.mentee._id);
        return { ...r, menteeProfile: menteeProfile || null };
      }
    })
  );
};

// ─────────────────────────────────────────────────────────────
const getConnectDetail = async (requestId, currentUser) => {
  const request = await connectRequestRepository.findRequestByIdLean(requestId);

  if (!request) {
    const err = new Error("Session not found"); err.statusCode = 404; throw err;
  }

  const userId   = currentUser._id.toString();
  const isMentee = request.mentee._id.toString() === userId;
  const isMentor = request.mentor._id.toString() === userId;

  if (!isMentee && !isMentor) {
    const err = new Error("Not authorized to view this session"); err.statusCode = 403; throw err;
  }

  const [mentorProfile, menteeProfile] = await Promise.all([
    connectRequestRepository.findMentorProfileForDetail(request.mentor._id),
    connectRequestRepository.findMenteeProfile(request.mentee._id),
  ]);

  return {
    ...request,
    mentorProfile:  mentorProfile || null,
    menteeProfile:  menteeProfile || null,
    viewerRole:     isMentee ? "mentee" : "mentor",
  };
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