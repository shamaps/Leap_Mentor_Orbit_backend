const pushSubscriptionService = require("../services/PushSubscription.service");

const { logger } = require("@sentry/node");
// POST /api/push/subscribe
const subscribe = async (req, res) => {
  try {
    const { status, body } = await pushSubscriptionService.subscribe({
      userId: req.user._id,
      subscription: req.body.subscription,
    });
    return res.status(status).json(body);
  } catch (err) {
    logger.error("Unhandled error in pushSubscription.controller", { error: err.message, stack: err.stack });
    return res.status(500).json({ message: "Failed to save subscription" });
  }
};

// DELETE /api/push/unsubscribe
const unsubscribe = async (req, res) => {
  try {
    const { status, body } = await pushSubscriptionService.unsubscribe({
      userId: req.user._id,
      endpoint: req.body.endpoint,
    });
    return res.status(status).json(body);
  } catch (err) {
    logger.error("Unhandled error in pushSubscription.controller", { error: err.message, stack: err.stack });
    return res.status(500).json({ message: "Failed to unsubscribe" });
  }
};

// GET /api/push/vapid-public-key
const getVapidPublicKey = (req, res) => {
  const { status, body } = pushSubscriptionService.getVapidPublicKey();
  return res.status(status).json(body);
};

module.exports = { subscribe, unsubscribe, getVapidPublicKey };