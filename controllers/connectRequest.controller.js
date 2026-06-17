// controllers/connectRequest.controller.js
const service = require("../services/connectRequest.service");
const logger = require("../utils/logger");
const { handleError } = require("../utils/appError");
const { ok, created, fail, noContent } = require("../utils/response");
const sendConnectRequest = async (req, res, next) => {
  try {
    const { mentorId, message, selectedSlots, sessionRate, sessionCount } = req.body;

    const request = await service.sendRequest({
      mentorId,
      menteeId: req.user._id,
      menteeName: req.user.name,
      message,
      selectedSlots,
      sessionRate,
      sessionCount,
    });

    logger.info("Connect request sent", {
      menteeId: req.user._id.toString(),
      mentorId,
      requestId: request._id.toString(),
      slotCount: selectedSlots?.length,
    });

    logger.info("sendConnectRequest completed successfully");
    return created(res, { message: "Connect request sent successfully", request });
  } catch (err) {
    if (err.code === 11000) {
      logger.warn("Duplicate connect request attempt", {
        menteeId: req.user._id.toString(),
        mentorId: req.body.mentorId,
      });
      return fail(res, "You already have a pending request with this mentor", 409);
    }
    return handleError(res, err, "connectRequest.sendConnectRequest");
  }
};

const getMyRequests = async (req, res, next) => {
  try {
    const requests = await service.getMyRequests(req.user._id);
    logger.info("getMyRequests completed successfully");
    return ok(res, { requests });
  } catch (err) {
    return handleError(res, err, "connectRequest.getMyRequests");
  }
};

const getIncomingRequests = async (req, res, next) => {
  try {
    const requests = await service.getIncomingRequests(req.user._id, req.query.status);
    logger.info("getIncomingRequests completed successfully");
    return ok(res, { requests });
  } catch (err) {
    return handleError(res, err, "connectRequest.getIncomingRequests");
  }
};


const respondToRequest = async (req, res, next) => {
  try {
    const { status, confirmedSlot } = req.body;

    const request = await service.respondToRequest({   // ← wrap in object
      requestId: req.params.id,
      mentorUserId: req.user._id,
      status,
      confirmedSlot,
    });

    logger.info("Connect request responded", {
      mentorId: req.user._id.toString(),
      requestId: req.params.id,
      status,
      confirmedSlot: confirmedSlot?.date,
    });

    logger.info("respondToRequest completed successfully");
    return ok(res, { message: `Request ${status} successfully`, request });
  } catch (err) {
    return handleError(res, err, "connectRequest.respondToRequest");
  }
};

const cancelRequest = async (req, res, next) => {
  try {
    await service.cancelRequest(req.params.id, req.user._id);

    logger.info("Connect request cancelled", {
      menteeId: req.user._id.toString(),
      requestId: req.params.id,
    });

    return res.status(204).send();
  } catch (err) {
    return handleError(res, err, "connectRequest.cancelRequest");
  }
};

const referRequest = async (req, res, next) => {
  try {
    const { originalRequest, newRequest } = await service.referRequest(
      req.params.id,
      req.user._id,
      req.body.referToMentorId
    );

    logger.info("Connect request referred", {
      mentorId: req.user._id.toString(),
      requestId: req.params.id,
      referToMentorId: req.body.referToMentorId,
      newRequestId: newRequest._id.toString(),
    });

    logger.info("referRequest completed successfully");
    return ok(res, { message: "Request referred successfully", originalRequest, newRequest });
  } catch (err) {
    return handleError(res, err, "connectRequest.referRequest");
  }
};

const getOngoingConnects = async (req, res, next) => {
  try {
    const connects = await service.getOngoingConnects(req.user._id);
    logger.info("getOngoingConnects completed successfully");
    return ok(res, { connects });
  } catch (err) {
    return handleError(res, err, "connectRequest.getOngoingConnects");
  }
};

const getConnectDetail = async (req, res, next) => {
  try {
    const connect = await service.getConnectDetail(req.params.id, req.user._id);
    logger.info("getConnectDetail completed successfully");
    return ok(res, { connect });
  } catch (err) {
    return handleError(res, err, "connectRequest.getConnectDetail");
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