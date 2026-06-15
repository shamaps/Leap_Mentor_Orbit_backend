const pushSubscriptionService = require("../services/PushSubscription.service");
const { handleError } = require("../utils/AppError");

// POST /api/push/subscribe
const subscribe = async (req, res) => {
  try {
    const { status, body } = await pushSubscriptionService.subscribe({
      userId: req.user._id,
      subscription: req.body.subscription,
    });
    logger.info("subscribe completed successfully");
    return res.status(status).json(body);
  } catch (err) {
    return handleError(res, err, "pushSubscription.subscribe");
  }
};


// DELETE /api/push/unsubscribe
const unsubscribe = async (req, res) => {
  try {
    const { status, body } = await pushSubscriptionService.unsubscribe({
      userId: req.user._id,
      endpoint: req.body.endpoint,
    });
    logger.info("unsubscribe completed successfully");
    return body ? res.status(status).json(body) : res.status(status).send();
  } catch (err) {
    return handleError(res, err, "pushSubscription.unsubscribe");
  }
};

// GET /api/push/vapid-public-key
const getVapidPublicKey = (req, res) => {
  const { status, body } = pushSubscriptionService.getVapidPublicKey();
  return res.status(status).json(body);
};

module.exports = { subscribe, unsubscribe, getVapidPublicKey };