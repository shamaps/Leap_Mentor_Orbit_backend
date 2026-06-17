const pushSubscriptionService = require("../services/PushSubscription.service");
const { handleError } = require("../utils/appError");
const logger = require("../utils/logger");
const { ok, noContent } = require("../utils/response"); 

// POST /api/push/subscribe
const subscribe = async (req, res) => {
  try {
    const { body } = await pushSubscriptionService.subscribe({
      userId: req.user._id,
      subscription: req.body.subscription,
    });
    logger.info("subscribe completed successfully");
    return ok(res, body);
  } catch (err) {
    return handleError(res, err, "pushSubscription.subscribe");
  }
};


// DELETE /api/push/unsubscribe
const unsubscribe = async (req, res) => {
  try {
    const {  body } = await pushSubscriptionService.unsubscribe({
      userId: req.user._id,
      endpoint: req.body.endpoint,
    });
    logger.info("unsubscribe completed successfully");
    return body ? ok(res, body) : noContent(res);
  } catch (err) {
    return handleError(res, err, "pushSubscription.unsubscribe");
  }
};

// GET /api/push/vapid-public-key
const getVapidPublicKey = (req, res) => {
  const { body } = pushSubscriptionService.getVapidPublicKey();
  return ok(res, body);
};

module.exports = { subscribe, unsubscribe, getVapidPublicKey };