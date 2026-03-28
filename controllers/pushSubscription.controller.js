const PushSubscription = require("../models/PushSubscription");

// POST /api/push/subscribe
const subscribe = async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth)
      return res.status(400).json({ message: "Invalid subscription object" });

    // Upsert — update if exists, create if not
    await PushSubscription.findOneAndUpdate(
      { user: req.user._id, "subscription.endpoint": subscription.endpoint },
      { user: req.user._id, subscription },
      { upsert: true, new: true }
    );

    res.json({ message: "Push subscription saved" });
  } catch (err) {
    res.status(500).json({ message: "Failed to save subscription" });
  }
};

// DELETE /api/push/unsubscribe
const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;
    await PushSubscription.findOneAndDelete({
      user: req.user._id,
      "subscription.endpoint": endpoint,
    });
    res.json({ message: "Unsubscribed successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to unsubscribe" });
  }
};

// GET /api/push/vapid-public-key
const getVapidPublicKey = (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
};

module.exports = { subscribe, unsubscribe, getVapidPublicKey };