const PushSubscription = require("../models/PushSubscription");

const upsertSubscription = (userId, subscription) =>
    PushSubscription.findOneAndUpdate(
        { user: userId, "subscription.endpoint": subscription.endpoint },
        { user: userId, subscription },
        { upsert: true, new: true }
    );

const deleteSubscription = (userId, endpoint) =>
    PushSubscription.findOneAndDelete({
        user: userId,
        "subscription.endpoint": endpoint,
    });

module.exports = {
    upsertSubscription,
    deleteSubscription,
};