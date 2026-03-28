const webpush = require("web-push");
const PushSubscription = require("../models/PushSubscription");

webpush.setVapidDetails(
  process.env.VAPID_MAILTO,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Send a push notification to a user by their userId
 * Silently skips if user has no subscription
 */
const sendPushNotification = async (userId, { title, message, type = "info", url = "/" }) => {
  try {
    const subs = await PushSubscription.find({ user: userId });
    if (!subs.length) return; // user hasn't subscribed — skip silently

    const payload = JSON.stringify({ title, message, type, url });

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(sub.subscription, payload);
        } catch (err) {
          // 410 Gone = subscription expired, clean it up
          if (err.statusCode === 410) {
            await PushSubscription.findByIdAndDelete(sub._id);
          }
        }
      })
    );
  } catch (err) {
    console.error("❌ Push notification failed:", err.message);
  }
};

module.exports = sendPushNotification;