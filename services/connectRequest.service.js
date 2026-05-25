// services/connectRequest.service.js
const mongoose = require("mongoose");
const repo = require("../repositories/connectRequest.repository");
const createNotification = require("../utils/createNotification");
const {
  sendConnectRequestEmail,
  sendRequestAcceptedEmail,
} = require("../utils/sendNotificationEmail");

const getEmitToUser = () => require("../socket/socketHandler").emitToUser;

// ─────────────────────────────────────────────────────────────
// HELPERS — pulled out of controllers to reduce complexity
// ─────────────────────────────────────────────────────────────

/**
 * Validate the payload for sending a connect request.
 * Throws a typed error if any check fails.
 */
const validateSendRequestPayload = ({ mentorId, menteeId, selectedSlots, sessionRate, sessionCount }) => {
  if (!mentorId)
    throw Object.assign(new Error("mentorId is required"), { status: 400 });

  if (!Array.isArray(selectedSlots) || selectedSlots.length === 0)
    throw Object.assign(new Error("At least one slot must be selected"), { status: 400 });

  if (selectedSlots.length > 5)
    throw Object.assign(new Error("Maximum 5 slots can be proposed"), { status: 400 });

  for (const slot of selectedSlots) {
    if (!slot.day || !slot.date || !slot.startTime || !slot.endTime)
      throw Object.assign(
        new Error("Each slot must have day, date, startTime and endTime"),
        { status: 400 }
      );
  }

  if (menteeId.toString() === mentorId)
    throw Object.assign(new Error("You cannot send a request to yourself"), { status: 400 });

  if (sessionRate && Number(sessionRate) < 1)
    throw Object.assign(new Error("sessionRate must be at least 1"), { status: 400 });

  if (sessionCount && Number(sessionCount) < 1)
    throw Object.assign(new Error("sessionCount must be at least 1"), { status: 400 });
};

/**
 * Check that no pending request or slot conflict already exists.
 * Throws typed errors if conflicts found.
 */
const checkRequestConflicts = async (menteeId, mentorId, selectedSlots) => {
  const existingPending = await repo.findPendingRequest(menteeId, mentorId);
  if (existingPending)
    throw Object.assign(
      new Error("You already have a pending request with this mentor"),
      { status: 409 }
    );

  for (const slot of selectedSlots) {
    const slotTaken = await repo.findSlotConflict(mentorId, slot);
    if (slotTaken)
      throw Object.assign(
        new Error(`Slot ${slot.date} ${slot.startTime}–${slot.endTime} is already taken. Please choose another.`),
        { status: 409 }
      );
  }
};

/**
 * Emit real-time socket events after a request status change.
 */
const emitStatusChange = (emitToUser, userIds, requestId, status) => {
  if (!emitToUser) return;
  userIds.forEach((userId) => {
    emitToUser(userId.toString(), "request_status_changed", {
      requestId: requestId.toString(),
      status,
    });
  });
};

// ─────────────────────────────────────────────────────────────
// sendRequest
// ─────────────────────────────────────────────────────────────

/**
 * Mentee sends a connect request with proposed slots.
 * @param {Object} params
 * @param {string} params.mentorId
 * @param {string} params.menteeId
 * @param {string} params.menteeName
 * @param {string} params.message
 * @param {Array}  params.selectedSlots
 * @param {number} params.sessionRate
 * @param {number} params.sessionCount
 * @returns {Promise<ConnectRequest>}
 */
const sendRequest = async ({ mentorId, menteeId, menteeName, message, selectedSlots, sessionRate, sessionCount }) => {
  // 1 — validate
  validateSendRequestPayload({ mentorId, menteeId, selectedSlots, sessionRate, sessionCount });

  // 2 — conflict checks
  await checkRequestConflicts(menteeId, mentorId, selectedSlots);

  // 3 — create
  const request = await repo.createConnectRequest({
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

  // 4 — populate mentor for notification + email
  await request.populate("mentor", "name email");

  // 5 — in-app notification to mentor
  await createNotification({
    recipient: new mongoose.Types.ObjectId(mentorId),
    type: "connect_request_received",
    title: "New Connect Request",
    message: "You have a new connect request from a mentee.",
    metadata: { requestId: request._id, menteeId },
  });

  // 6 — real-time socket events
  const emitToUser = getEmitToUser();
  if (emitToUser) {
    emitToUser(mentorId, "new_connect_request", {
      title: "New Connect Request 🔔",
      message: `${menteeName} sent you a connect request.`,
      type: "info",
    });
    emitStatusChange(emitToUser, [mentorId], request._id, "pending");
  }

  // 7 — email (non-blocking)
  sendConnectRequestEmail({
    mentorName: request.mentor?.name || "Mentor",
    mentorEmail: request.mentor?.email,
    menteeName,
    slots: selectedSlots,
    message: message?.trim() || "",
  }).catch((err) => console.error("❌ Connect request email failed:", err.message));

  return request;
};

// ─────────────────────────────────────────────────────────────
// getMyRequests — mentee views sent requests
// ─────────────────────────────────────────────────────────────

/**
 * Enrich mentee's sent requests with mentor and referredTo profiles.
 */
const getMyRequests = async (menteeId) => {
  const requests = await repo.findMyRequests(menteeId);

  return Promise.all(
    requests.map(async (r) => ({
      ...r,
      mentorProfile: await repo.findMentorProfile(r.mentor?._id) || null,
      referredToProfile: r.referredTo
        ? await repo.findMentorProfileFull(r.referredTo?._id) || null
        : null,
    }))
  );
};

// ─────────────────────────────────────────────────────────────
// getIncomingRequests — mentor views received requests
// ─────────────────────────────────────────────────────────────

/**
 * Enrich mentor's incoming requests with referredBy profiles.
 */
const getIncomingRequests = async (mentorId, status) => {
  const requests = await repo.findIncomingRequests(mentorId, status);

  return Promise.all(
    requests.map(async (r) => ({
      ...r,
      referredByProfile: r.referredBy
        ? await repo.findMentorProfileFull(r.referredBy._id) || null
        : null,
    }))
  );
};

// ─────────────────────────────────────────────────────────────
// respondToRequest — mentor accepts or rejects
// ─────────────────────────────────────────────────────────────

/**
 * Handle accept/reject notifications and side effects.
 * Extracted to keep respondToRequest under complexity limit.
 */
const handleAccepted = async (request, confirmedSlot, emitToUser) => {
  // notify mentee in-app
  await createNotification({
    recipient: request.mentee._id,
    type: "connect_request_accepted",
    title: "Connect Request Accepted! 🎉",
    message: `${request.mentor.name} has accepted your connect request. Your session is confirmed on ${confirmedSlot.date} at ${confirmedSlot.startTime}.`,
    metadata: { requestId: request._id, mentorId: request.mentor._id },
  });

  // real-time toast to mentee
  if (emitToUser) {
    emitToUser(request.mentee._id.toString(), "request_accepted", {
      title: "Request Accepted! 🎉",
      message: `${request.mentor.name} accepted your connect request.`,
      type: "success",
    });
  }

  // reject other requests for the same slot
  await repo.rejectConflictingSlots(request._id, request.mentor._id, confirmedSlot);

  // email (non-blocking)
  sendRequestAcceptedEmail({
    menteeName: request.mentee.name,
    menteeEmail: request.mentee.email,
    mentorName: request.mentor.name,
    confirmedSlot,
    slots: request.selectedSlots,
  }).catch((err) => console.error("❌ Request accepted email failed:", err.message));
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

/**
 * Mentor accepts or rejects a connect request.
 * @param {string} requestId
 * @param {string} mentorUserId  — from req.user._id
 * @param {string} status        — "accepted" | "rejected"
 * @param {Object} confirmedSlot — required when accepting
 * @returns {Promise<ConnectRequest>}
 */
const respondToRequest = async (requestId, mentorUserId, status, confirmedSlot) => {
  // 1 — validate status
  if (!["accepted", "rejected"].includes(status))
    throw Object.assign(new Error("Status must be 'accepted' or 'rejected'"), { status: 400 });

  // 2 — validate confirmedSlot when accepting
  if (status === "accepted") {
    if (!confirmedSlot?.date || !confirmedSlot?.startTime || !confirmedSlot?.endTime)
      throw Object.assign(new Error("confirmedSlot is required when accepting"), { status: 400 });
  }

  // 3 — fetch request
  const request = await repo.findRequestByIdWithUsers(requestId);
  if (!request)
    throw Object.assign(new Error("Request not found"), { status: 404 });

  // 4 — authorization
  if (request.mentor._id.toString() !== mentorUserId.toString())
    throw Object.assign(new Error("Not authorized to respond to this request"), { status: 403 });

  // 5 — state guard
  if (request.status !== "pending")
    throw Object.assign(new Error(`Request already ${request.status}`), { status: 400 });

  // 6 — update + save
  request.status = status;
  request.respondedAt = new Date();
  if (status === "accepted") request.confirmedSlot = confirmedSlot;
  await repo.saveRequest(request);

  // 7 — real-time status sync to both dashboards
  const emitToUser = getEmitToUser();
  emitStatusChange(emitToUser, [request.mentee._id, request.mentor._id], request._id, status);

  // 8 — side effects per status
  if (status === "accepted") await handleAccepted(request, confirmedSlot, emitToUser);
  if (status === "rejected") await handleRejected(request, emitToUser);

  return request;
};

// ─────────────────────────────────────────────────────────────
// cancelRequest — mentee cancels a pending request
// ─────────────────────────────────────────────────────────────

/**
 * @param {string} requestId
 * @param {string} menteeUserId — from req.user._id
 */
const cancelRequest = async (requestId, menteeUserId) => {
  const request = await repo.findRequestById(requestId);

  if (!request)
    throw Object.assign(new Error("Request not found"), { status: 404 });

  if (request.mentee.toString() !== menteeUserId.toString())
    throw Object.assign(new Error("Not authorized to cancel this request"), { status: 403 });

  if (request.status === "ongoing")
    throw Object.assign(new Error("Cannot delete an ongoing session"), { status: 400 });

  await repo.deleteRequestById(requestId);
};

// ─────────────────────────────────────────────────────────────
// referRequest — mentor refers to another mentor
// ─────────────────────────────────────────────────────────────

/**
 * @param {string} requestId
 * @param {string} mentorUserId    — from req.user._id
 * @param {string} referToMentorId — target mentor
 * @returns {Promise<{ originalRequest, newRequest }>}
 */
const referRequest = async (requestId, mentorUserId, referToMentorId) => {
  if (!referToMentorId)
    throw Object.assign(new Error("referToMentorId is required"), { status: 400 });

  const request = await repo.findRequestByIdWithUsers(requestId);
  if (!request)
    throw Object.assign(new Error("Request not found"), { status: 404 });

  if (request.mentor._id.toString() !== mentorUserId.toString())
    throw Object.assign(new Error("Not authorized to refer this request"), { status: 403 });

  if (request.status !== "pending")
    throw Object.assign(new Error(`Cannot refer a request that is already ${request.status}`), { status: 400 });

  if (referToMentorId === mentorUserId.toString())
    throw Object.assign(new Error("Cannot refer request to yourself"), { status: 400 });

  const existingRequest = await repo.findExistingReferral(request.mentee._id, referToMentorId);
  if (existingRequest)
    throw Object.assign(new Error("Mentee already has a pending request with this mentor"), { status: 409 });

  // create new request for referred mentor
  const newRequest = await repo.createConnectRequest({
    mentee: request.mentee._id,
    mentor: referToMentorId,
    message: request.message,
    selectedSlots: request.selectedSlots,
    requestedAt: new Date(),
    referredBy: mentorUserId,
  });

  // notifications
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

  // real-time
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

  // update original request
  request.status = "referred";
  request.referredTo = referToMentorId;
  request.referredRequestId = newRequest._id;
  request.respondedAt = new Date();
  await repo.saveRequest(request);

  return { originalRequest: request, newRequest };
};

// ─────────────────────────────────────────────────────────────
// getOngoingConnects
// ─────────────────────────────────────────────────────────────

/**
 * Returns ongoing/completed connects enriched with profiles.
 */
const getOngoingConnects = async (userId) => {
  const requests = await repo.findOngoingConnects(userId);

  return Promise.all(
    requests.map(async (r) => {
      const isMentee = r.mentee._id.toString() === userId.toString();
      if (isMentee) {
        return { ...r, mentorProfile: await repo.findMentorProfile(r.mentor._id) || null };
      }
      return { ...r, menteeProfile: await repo.findMenteeProfile(r.mentee._id) || null };
    })
  );
};

// ─────────────────────────────────────────────────────────────
// getConnectDetail
// ─────────────────────────────────────────────────────────────

/**
 * Returns full detail of a single connect request with both profiles.
 * @param {string} requestId
 * @param {string} userId — from req.user._id
 */
const getConnectDetail = async (requestId, userId) => {
  const request = await repo.findRequestByIdLean(requestId);
  if (!request)
    throw Object.assign(new Error("Session not found"), { status: 404 });

  const isMentee = request.mentee._id.toString() === userId.toString();
  const isMentor = request.mentor._id.toString() === userId.toString();

  if (!isMentee && !isMentor)
    throw Object.assign(new Error("Not authorized to view this session"), { status: 403 });

  const [mentorProfile, menteeProfile] = await Promise.all([
    repo.findMentorProfile(request.mentor._id),
    repo.findMenteeProfile(request.mentee._id),
  ]);

  return {
    ...request,
    mentorProfile: mentorProfile || null,
    menteeProfile: menteeProfile || null,
    viewerRole: isMentee ? "mentee" : "mentor",
  };
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