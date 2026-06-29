const PushSubscription = require("../models/PushSubscription");

/**
 * Searches the collection by user and endpoint compound indices, inserting or updating the dynamic structure.
 * * @function upsertSubscription
 * @param {any} userId - Target primary account owner unique indicator key.
 * @param {Object} subscription - The structured web push authorization parameters object.
 * @param {string} subscription.endpoint - Canonical destination gateway endpoint selector.
 * @returns {import('mongoose').Query} The updated or generated Mongoose tracking model document row.
 */
const upsertSubscription = (userId, subscription) =>
    PushSubscription.findOneAndUpdate(
        { user: userId, "subscription.endpoint": subscription.endpoint },
        { user: userId, subscription },
        { upsert: true, new: true }
    );

/**
 * Hard discards a single dynamic device subscription map completely from persistent pools.
 * * @function deleteSubscription
 * @param {any} userId - Security context reference tracking recipient identifier credentials.
 * @param {string} endpoint - The target push gateway target string to be removed.
 * @returns {import('mongoose').Query} Operations summary confirming deleted documentation indicators.
 */
const deleteSubscription = (userId, endpoint) =>
    PushSubscription.findOneAndDelete({
        user: userId,
        "subscription.endpoint": endpoint,
    });

module.exports = {
    upsertSubscription,
    deleteSubscription,
};