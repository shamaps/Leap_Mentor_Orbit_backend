// services/connectRequest.service.js
const mongoose = require("mongoose");
const repo = require("../repositories/connectRequest.repository");
const createNotification = require("../utils/createNotification");
const logger = require("../utils/logger");
const {
  sendConnectRequestEmail,
  sendRequestAcceptedEmail,
} = require("../utils/sendNotificationEmail");
const { VALID_RESPOND_STATUSES } = require("../config/constants");
const AppError = require("../utils/AppError");

// Lazily require the socket handler to avoid circular-require issues at module load time
const getEmitToUser = () => require("../socket/socketHandler").emitToUser;

/**
 * Validates the payload for sending a new connect request.
 * Throws AppError(400) on the first rule that is violated.
 *
 * @param {Object} payload
 * @param {string} payload.mentorId - ID of the mentor being requested
 * @param {mongoose.Types.ObjectId|string} payload.menteeId - ID of the requesting mentee
 * @param {Array<{day:string, date:string, startTime:string, endTime:string}>} payload.selectedSlots
 *   - Proposed slots, 1 to 5 inclusive, each must have day/date/startTime/endTime
 * @param {number} [payload.sessionRate] - Optional rate per session (must be >= 1 if provided)
 * @param {number} [payload.sessionCount] - Optional number of sessions (must be >= 1 if provided)
 * @throws {AppError} 400 - If any validation rule fails
 */
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

/**
 * Ensures the mentee doesn't already have a pending request with this mentor,
 * and that none of the proposed slots are already taken by another accepted request.
 *
 * @param {mongoose.Types.ObjectId|string} menteeId
 * @param {string} mentorId
 * @param {Array<{day:string, date:string, startTime:string, endTime:string}>} selectedSlots
 * @throws {AppError} 409 - If a duplicate pending request exists, or any slot is already taken
 */
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

/**
 * Emits a "request_status_changed" socket event to one or more users.
 * No-ops silently if the socket layer isn't available (e.g. during tests).
 *
 * @param {Object} params
 * @param {Function|null} params.emitToUser - Socket emit function, or null/undefined if unavailable
 * @param {Array<mongoose.Types.ObjectId|string>} params.userIds - Users to notify
 * @param {mongoose.Types.ObjectId|string} params.requestId - The ConnectRequest being updated
 * @param {string} params.status - New status (e.g. "pending", "accepted", "rejected", "referred")
 */
const emitStatusChange = ({ emitToUser, userIds, requestId, status }) => {
  if (!emitToUser) return;
  userIds.forEach((userId) => {
    emitToUser(userId.toString(), "request_status_changed", {
      requestId: requestId.toString(),
      status,
    });
  });
};

/**
 * Creates a new connect request from a mentee to a mentor.
 * Validates the payload, checks for conflicts, persists the request,
 * notifies the mentor (in-app notification + socket event), and
 * fires off a confirmation email (non-blocking).
 *
 * @param {Object} payload
 * @param {string} payload.mentorId
 * @param {mongoose.Types.ObjectId|string} payload.menteeId
 * @param {string} payload.menteeName - Display name shown in mentor's notification
 * @param {string} [payload.message] - Optional message from the mentee to the mentor
 * @param {Array<{day:string, date:string, startTime:string, endTime:string}>} payload.selectedSlots
 * @param {number} [payload.sessionRate]
 * @param {number} [payload.sessionCount]
 * @returns {Promise<Object>} The newly created ConnectRequest document (mentor populated)
 * @throws {AppError} 400 - Invalid payload
 * @throws {AppError} 409 - Duplicate request or slot conflict
 */
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

  // Persisted notification — visible in the mentor's notification center
  await createNotification({
    recipient: new mongoose.Types.ObjectId(mentorId),
    type: "connect_request_received",
    title: "New Connect Request",
    message: "You have a new connect request from a mentee",
    metadata: { requestId: request._id, menteeId },
  });

  // Real-time toast + status update if the mentor is currently online
  const emitToUser = getEmitToUser();
  if (emitToUser) {
    emitToUser(mentorId, "new_connect_request", {
      title: "New Connect Request 🔔",
      message: `${menteeName} sent you a connect request`,
      type: "info",
    });
    emitStatusChange({
      emitToUser,
      userIds: [mentorId],
      requestId: request._id,
      status: "pending"
    });
  }

  // Email is best-effort — failure here should not fail the request
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

/**
 * Returns all connect requests sent by a mentee, enriched with the
 * mentor's profile and (if referred elsewhere) the referred-to mentor's profile.
 *
 * @param {mongoose.Types.ObjectId|string} menteeId
 * @returns {Promise<Array<Object>>} Requests with `mentorProfile` and `referredToProfile` attached
 */
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

/**
 * Returns all connect requests received by a mentor, optionally filtered by status,
 * enriched with the referring mentor's profile (if the request was referred to them).
 *
 * @param {string} mentorId
 * @param {string} [status] - Optional status filter (e.g. "pending")
 * @returns {Promise<Array<Object>>} Requests with `referredByProfile` attached
 */
const getIncomingRequests = async (mentorId, status) => {
  const requests = await repo.findIncomingRequests(mentorId, status);
  return Promise.all(
    requests.map(async (r) => ({
      ...r,
      referredByProfile: r.referredBy ? await repo.findMentorProfileFull(r.referredBy._id) || null : null,
    }))
  );
};

/**
 * Side effects for an "accepted" response: notifies the mentee (persisted + socket),
 * cancels any of the mentee's other pending slot proposals with this mentor that
 * now conflict with the confirmed slot, and sends a confirmation email.
 *
 * @param {Object} request - The ConnectRequest document (with populated mentor/mentee)
 * @param {{date:string, startTime:string, endTime:string}} confirmedSlot
 * @param {Function|null} emitToUser - Socket emit function, or null if unavailable
 */
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

  // Other pending slot proposals that overlap the confirmed slot are no longer valid
  await repo.rejectConflictingSlots(request._id, request.mentor._id, confirmedSlot);

  sendRequestAcceptedEmail({
    menteeName: request.mentee.name,
    menteeEmail: request.mentee.email,
    mentorName: request.mentor.name,
    confirmedSlot,
    slots: request.selectedSlots,
  }).catch((err) => logger.error("Request accepted email failed", { error: err.message }));
};

/**
 * Side effects for a "rejected" response: notifies the mentee via
 * a persisted notification and (if online) a real-time toast.
 *
 * @param {Object} request - The ConnectRequest document (with populated mentor/mentee)
 * @param {Function|null} emitToUser - Socket emit function, or null if unavailable
 */
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
 * Mentor responds to a pending connect request — accept or reject.
 * On accept, `confirmedSlot` becomes the locked-in session time and any
 * conflicting alternative slots are auto-rejected. Both parties are
 * notified via persisted notifications and real-time socket events.
 *
 * @param {Object} payload
 * @param {string} payload.requestId
 * @param {mongoose.Types.ObjectId|string} payload.mentorUserId - Must match request.mentor._id
 * @param {string} payload.status - One of VALID_RESPOND_STATUSES ("accepted" | "rejected")
 * @param {{date:string, startTime:string, endTime:string}} [payload.confirmedSlot] - Required when status is "accepted"
 * @returns {Promise<Object>} The updated ConnectRequest document
 * @throws {AppError} 400 - Invalid status, missing confirmedSlot, or request not pending
 * @throws {AppError} 403 - Caller is not the mentor on this request
 * @throws {AppError} 404 - Request not found
 */
const respondToRequest = async ({ requestId, mentorUserId, status, confirmedSlot }) => {
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
  emitStatusChange({ emitToUser, userIds: [request.mentee._id, request.mentor._id], requestId: request._id, status });

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

/**
 * Mentee cancels (deletes) their own pending/accepted/rejected/referred request.
 * Ongoing sessions cannot be cancelled this way.
 *
 * @param {string} requestId
 * @param {mongoose.Types.ObjectId|string} menteeUserId - Must match request.mentee
 * @returns {Promise<void>}
 * @throws {AppError} 403 - Caller is not the mentee on this request
 * @throws {AppError} 404 - Request not found
 * @throws {AppError} 400 - Request is currently "ongoing"
 */
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

/**
 * Mentor refers a pending request to a different mentor. Creates a new
 * ConnectRequest for the target mentor (carrying over the original slots/message),
 * marks the original request as "referred", and notifies both the mentee and the
 * new mentor.
 *
 * @param {string} requestId - The original request being referred
 * @param {mongoose.Types.ObjectId|string} mentorUserId - Must match request.mentor._id (the referring mentor)
 * @param {string} referToMentorId - The mentor to refer the mentee to
 * @returns {Promise<{originalRequest: Object, newRequest: Object}>}
 * @throws {AppError} 400 - Missing referToMentorId, request not pending, or self-referral
 * @throws {AppError} 403 - Caller is not the mentor on this request
 * @throws {AppError} 404 - Request not found
 * @throws {AppError} 409 - Mentee already has a pending request with the target mentor
 */
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

  const existingRequest = await repo.findPendingRequest(request.mentee._id, referToMentorId);
  if (existingRequest)
    throw new AppError(409, "Mentee already has a pending request with this mentor");

  // New request is created for the target mentor, carrying over the original details
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
    emitStatusChange({ emitToUser, userIds: [request.mentee._id], requestId: request._id, status: "referred" });
    emitStatusChange({ emitToUser, userIds: [referToMentorId], requestId: newRequest._id, status: "pending" });
  }

  // Mark the original request as referred and link it to the new one
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

/**
 * Returns all "ongoing" connect requests (active mentorship sessions) for a user,
 * enriched with the counterpart's profile — mentor profile if the user is the mentee,
 * mentee profile if the user is the mentor.
 *
 * @param {mongoose.Types.ObjectId|string} userId
 * @returns {Promise<Array<Object>>} Requests with `mentorProfile` or `menteeProfile` attached
 */
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

/**
 * Returns full details for a single connect request, including both
 * mentor and mentee profiles, for whichever side is viewing it.
 *
 * @param {string} requestId
 * @param {mongoose.Types.ObjectId|string} userId - The viewing user (must be the mentor or mentee on the request)
 * @returns {Promise<Object>} The request plus `mentorProfile`, `menteeProfile`, and `viewerRole` ("mentee" | "mentor")
 * @throws {AppError} 404 - Request not found
 * @throws {AppError} 403 - Viewer is neither the mentor nor the mentee on this request
 */
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