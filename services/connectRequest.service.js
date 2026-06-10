// services/connectRequest.service.js
const mongoose = require("mongoose");
const repo = require("../repositories/connectRequest.repository");
const createNotification = require("../utils/createNotification");
const { logger } = require("@sentry/node");
const {
  sendConnectRequestEmail,
  sendRequestAcceptedEmail,
} = require("../utils/sendNotificationEmail");
const { VALID_RESPOND_STATUSES } = require("../config/constants");
const AppError = require("../utils/AppError");
const getEmitToUser = () => require("../socket/socketHandler").emitToUser;

const validateSendRequestPayload = ({ mentorId, menteeId, selectedSlots, sessionRate, sessionCount }) => {
  if (!mentorId)
    throw new AppError(400, "mentorId is required");
  if (!Array.isArray(selectedSlots) || selectedSlots.length === 0)
    throw new AppError(400, "At least one slot must be selected");
  if (selectedSlots.length > 5)
    throw new AppError(400, "Maximum 5 slots can be proposed");
  for (const slot of selectedSlots) {
    if (!slot.day || !slot.date || !slot.startTime || !slot.endTime)
      throw new AppError(400, "Each slot must have day, date, startTime and endTime");
  }
  if (menteeId.toString() === mentorId)
    throw new AppError(400, "You cannot send a request to yourself");
  if (sessionRate && Number(sessionRate) < 1)
    throw new AppError(400, "sessionRate must be at least 1");
  if (sessionCount && Number(sessionCount) < 1)
    throw new AppError(400, "sessionCount must be at least 1");
};

const checkRequestConflicts = async (menteeId, mentorId, selectedSlots) => {
  const existingPending = await repo.findPendingRequest(menteeId, mentorId);
  if (existingPending) {
    logger.warn("Duplicate connect request blocked", {
      menteeId: menteeId.toString(),
      mentorId,
    });
    throw new AppError(409, "You already have a pending request with this mentor");
  }

  for (const slot of selectedSlots) {
    const slotTaken = await repo.findSlotConflict(mentorId, slot);
    if (slotTaken) {
      logger.warn("Slot conflict detected", {
        mentorId,
        slot: `${slot.date} ${slot.startTime}–${slot.endTime}`,
      });
      throw new AppError(409, `Slot ${slot.date} ${slot.startTime}–${slot.endTime} is already taken. Please choose another.`)
    }
  }
};

const emitStatusChange = (emitToUser, userIds, requestId, status) => {
  if (!emitToUser) return;
  userIds.forEach((userId) => {
    emitToUser(userId.toString(), "request_status_changed", {
      requestId: requestId.toString(),
      status,
    });
  });
};

const sendRequest = async ({ mentorId, menteeId, menteeName, message, selectedSlots, sessionRate, sessionCount }) => {
  validateSendRequestPayload({ mentorId, menteeId, selectedSlots, sessionRate, sessionCount });
  await checkRequestConflicts(menteeId, mentorId, selectedSlots);

  const request = await repo.createConnectRequest({
    mentee: menteeId,
    mentor: mentorId,
    message: message?.trim() || "",
    selectedSlots,
    requestedAt: new Date(),
    sessionRate: sessionRate ? Number(sessionRate) : null,
    sessionCount: sessionCount ? Number(sessionCount) : null,
    totalAmount: sessionRate && sessionCount ? Number(sessionRate) * Number(sessionCount) : null,
  });

  await request.populate("mentor", "name email");

  await createNotification({
    recipient: new mongoose.Types.ObjectId(mentorId),
    type: "connect_request_received",
    title: "New Connect Request",
    message: "You have a new connect request from a mentee",
    metadata: { requestId: request._id, menteeId },
  });

  const emitToUser = getEmitToUser();
  if (emitToUser) {
    emitToUser(mentorId, "new_connect_request", {
      title: "New Connect Request 🔔",
      message: `${menteeName} sent you a connect request`,
      type: "info",
    });
    emitStatusChange(emitToUser, [mentorId], request._id, "pending");
  }

  sendConnectRequestEmail({
    mentorName: request.mentor?.name || "Mentor",
    mentorEmail: request.mentor?.email,
    menteeName,
    slots: selectedSlots,
    message: message?.trim() || "",
  }).catch((err) => logger.error("Connect request email failed", { error: err.message }));

  logger.info("Connect request created", {
    requestId: request._id.toString(),
    menteeId: menteeId.toString(),
    mentorId,
    slotCount: selectedSlots.length,
  });

  return request;
};

const getMyRequests = async (menteeId) => {
  const requests = await repo.findMyRequests(menteeId);
  return Promise.all(
    requests.map(async (r) => ({
      ...r,
      mentorProfile: await repo.findMentorProfile(r.mentor?._id) || null,
      referredToProfile: r.referredTo ? await repo.findMentorProfileFull(r.referredTo?._id) || null : null,
    }))
  );
};

const getIncomingRequests = async (mentorId, status) => {
  const requests = await repo.findIncomingRequests(mentorId, status);
  return Promise.all(
    requests.map(async (r) => ({
      ...r,
      referredByProfile: r.referredBy ? await repo.findMentorProfileFull(r.referredBy._id) || null : null,
    }))
  );
};

const handleAccepted = async (request, confirmedSlot, emitToUser) => {
  await createNotification({
    recipient: request.mentee._id,
    type: "connect_request_accepted",
    title: "Connect Request Accepted! 🎉",
    message: `${request.mentor.name} has accepted your connect request. Your session is confirmed on ${confirmedSlot.date} at ${confirmedSlot.startTime}.`,
    metadata: { requestId: request._id, mentorId: request.mentor._id },
  });

  if (emitToUser) {
    emitToUser(request.mentee._id.toString(), "request_accepted", {
      title: "Request Accepted! 🎉",
      message: `${request.mentor.name} accepted your connect request`,
      type: "success",
    });
  }

  await repo.rejectConflictingSlots(request._id, request.mentor._id, confirmedSlot);

  sendRequestAcceptedEmail({
    menteeName: request.mentee.name,
    menteeEmail: request.mentee.email,
    mentorName: request.mentor.name,
    confirmedSlot,
    slots: request.selectedSlots,
  }).catch((err) => logger.error("Request accepted email failed", { error: err.message }));
};

const handleRejected = async (request, emitToUser) => {
  await createNotification({
    recipient: request.mentee._id,
    type: "connect_request_declined",
    title: "Connect Request Declined",
    message: `${request.mentor.name} was unable to accept your connect request at this time.`,
    metadata: { requestId: request._id, mentorId: request.mentor._id },
  });

  if (emitToUser) {
    emitToUser(request.mentee._id.toString(), "request_declined", {
      title: "Request Declined",
      message: `${request.mentor.name} was unable to accept your request at this time.`,
      type: "warning",
    });
  }
};

const respondToRequest = async (requestId, mentorUserId, status, confirmedSlot) => {
  if (!VALID_RESPOND_STATUSES.includes(status))
    throw new AppError(400, "Status must be 'accepted' or 'rejected'");
  if (status === "accepted") {
    if (!confirmedSlot?.date || !confirmedSlot?.startTime || !confirmedSlot?.endTime)
      throw new AppError(400, "confirmedSlot is required when accepting");
  }

  const request = await repo.findRequestByIdWithUsers(requestId);
  if (!request) throw new AppError(404, "Request not found");
  if (request.mentor._id.toString() !== mentorUserId.toString())
    throw new AppError(403, "Not authorized to respond to this request");
  if (request.status !== "pending")
    throw new AppError(400, `Request already ${request.status}`);

  request.status = status;
  request.respondedAt = new Date();
  if (status === "accepted") request.confirmedSlot = confirmedSlot;
  await repo.saveRequest(request);

  const emitToUser = getEmitToUser();
  emitStatusChange(emitToUser, [request.mentee._id, request.mentor._id], request._id, status);

  if (status === "accepted") await handleAccepted(request, confirmedSlot, emitToUser);
  if (status === "rejected") await handleRejected(request, emitToUser);

  logger.info("Connect request responded", {
    requestId,
    mentorId: mentorUserId.toString(),
    menteeId: request.mentee._id.toString(),
    status,
    confirmedDate: confirmedSlot?.date,
  });

  return request;
};

const cancelRequest = async (requestId, menteeUserId) => {
  const request = await repo.findRequestById(requestId);
  if (!request) throw new AppError(404, "Request not found");
  if (request.mentee.toString() !== menteeUserId.toString())
    throw new AppError(403, "Not authorized to cancel this request");
  if (request.status === "ongoing")
    throw new AppError(400, "Cannot delete an ongoing session");

  await repo.deleteRequestById(requestId);

  logger.info("Connect request cancelled", {
    requestId,
    menteeId: menteeUserId.toString(),
  });
};

const referRequest = async (requestId, mentorUserId, referToMentorId) => {
  if (!referToMentorId)
    throw new AppError(400, "referToMentorId is required");

  const request = await repo.findRequestByIdWithUsers(requestId);
  if (!request) throw new AppError(404, "Request not found");
  if (request.mentor._id.toString() !== mentorUserId.toString())
    throw new AppError(403, "Not authorized to refer this request");
  if (request.status !== "pending")
    throw new AppError(400, `Cannot refer a request that is already ${request.status}`);
  if (referToMentorId === mentorUserId.toString())
    throw new AppError(400, "Cannot refer request to yourself");

  const existingRequest = await repo.findExistingReferral(request.mentee._id, referToMentorId);
  if (existingRequest)
    throw new AppError(409, "Mentee already has a pending request with this mentor");

  const newRequest = await repo.createConnectRequest({
    mentee: request.mentee._id,
    mentor: referToMentorId,
    message: request.message,
    selectedSlots: request.selectedSlots,
    requestedAt: new Date(),
    referredBy: mentorUserId,
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
    emitStatusChange(emitToUser, [request.mentee._id], request._id, "referred");
    emitStatusChange(emitToUser, [referToMentorId], newRequest._id, "pending");
  }

  request.status = "referred";
  request.referredTo = referToMentorId;
  request.referredRequestId = newRequest._id;
  request.respondedAt = new Date();
  await repo.saveRequest(request);

  logger.info("Connect request referred", {
    requestId,
    mentorId: mentorUserId.toString(),
    menteeId: request.mentee._id.toString(),
    referToMentorId,
    newRequestId: newRequest._id.toString(),
  });

  return { originalRequest: request, newRequest };
};

const getOngoingConnects = async (userId) => {
  const requests = await repo.findOngoingConnects(userId);
  return Promise.all(
    requests.map(async (r) => {
      const isMentee = r.mentee._id.toString() === userId.toString();
      if (isMentee) return { ...r, mentorProfile: await repo.findMentorProfile(r.mentor._id) || null };
      return { ...r, menteeProfile: await repo.findMenteeProfile(r.mentee._id) || null };
    })
  );
};

const getConnectDetail = async (requestId, userId) => {
  const request = await repo.findRequestByIdLean(requestId);
  if (!request) throw new AppError(404, "Session not found");

  const isMentee = request.mentee._id.toString() === userId.toString();
  const isMentor = request.mentor._id.toString() === userId.toString();

  if (!isMentee && !isMentor)
    throw new AppError(403, "Not authorized to view this session");

  const [mentorProfile, menteeProfile] = await Promise.all([
    repo.findMentorProfile(request.mentor._id),
    repo.findMenteeProfile(request.mentee._id),
  ]);

  return { ...request, mentorProfile: mentorProfile || null, menteeProfile: menteeProfile || null, viewerRole: isMentee ? "mentee" : "mentor" };
};

module.exports = {
  sendRequest,
  getMyRequests,
  getIncomingRequests,
  respondToRequest,
  cancelRequest,
  referRequest,
  getOngoingConnects,
  getConnectDetail,
};