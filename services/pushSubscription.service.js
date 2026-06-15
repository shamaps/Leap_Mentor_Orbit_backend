const repo = require("../repositories/PushSubscription.repository");

const subscribe = async ({ userId, subscription }) => {
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return { status: 400, body: { message: "Invalid subscription object" } };
    }

    await repo.upsertSubscription(userId, subscription);
    return { status: 200, body: { message: "Push subscription saved" } };
};

const unsubscribe = async ({ userId, endpoint }) => {
    await repo.deleteSubscription(userId, endpoint);
    return { status: 204, body: null };
};

const getVapidPublicKey = () => ({
    status: 200,
    body: { publicKey: process.env.VAPID_PUBLIC_KEY },
});

module.exports = { subscribe, unsubscribe, getVapidPublicKey };