const config = require("../config/env");

/**
 * @typedef {Object} SubscriptionKeys
 * @property {string} p256dh - The public key used for elliptic curve diffie-hellman encryption.
 * @property {string} auth - The authentication secret string.
 */

/**
 * @typedef {Object} WebPushSubscription
 * @property {string} endpoint - The unique push service destination URL.
 * @property {SubscriptionKeys} keys - Crypto keys container payload context.
 */

/**
 * @typedef {Object} PushSubscriptionRepository
 * @property {(userId: any, subscription: WebPushSubscription) => Promise<Object>} upsertSubscription - Performs a dynamic database upsert matching the target endpoint.
 * @property {(userId: any, endpoint: string) => Promise<Object|null>} deleteSubscription - Discards the specific push mapping from databases.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string) => void} info - Logs routine service method milestones.
 * @property {(message: string, error: any) => void} error - Traces application exception errors.
 */

/**
 * Factory function constructing the core execution logic layer for processing web push subscriptions.
 * * @param {PushSubscriptionRepository} repo - Data layer persistence abstraction instance.
 * @param {{ logger: Logger }} dependencies - Application core tracing infrastructure.
 * @returns {Object} Configured service interface containing push registration handlers.
 */
const createPushSubscriptionService = (repo, { logger }) => {

    /**
     * Asserts the validity of an incoming Web Push API structure and registers it on the data layer.
     * * @async
     * @function subscribe
     * @param {Object} parameters - Intake configuration parameters container.
     * @param {any} parameters.userId - Secure user identifier signature key checking subscription ownership.
     * @param {WebPushSubscription} parameters.subscription - The push event metadata target object.
     * @returns {Promise<{ status: number, body: { message: string } }>} Internal response payload descriptor envelope.
     */
    const subscribe = async ({ userId, subscription }) => {
        if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
            return { status: 400, body: { message: "Invalid subscription object" } };
        }

        await repo.upsertSubscription(userId, subscription);
        return { status: 200, body: { message: "Push subscription saved" } };
    };

    /**
     * Unregisters a targeted web push terminal node from receiving notifications.
     * * @async
     * @function unsubscribe
     * @param {Object} context - Target identification container payload.
     * @param {any} context.userId - Authenticated user identifier verification key string.
     * @param {string} context.endpoint - The unique push service destination URL to be removed.
     * @returns {Promise<{ status: number, body: null }>} Standardized internal termination payload.
     */
    const unsubscribe = async ({ userId, endpoint }) => {
        await repo.deleteSubscription(userId, endpoint);
        return { status: 204, body: null };
    };

    /**
     * Reads the application-wide environment configuration to return public VAPID identifying vectors.
     * * @function getVapidPublicKey
     * @returns {{ status: number, body: { publicKey: string } }} Response envelope mapping the VAPID key.
     */
    const getVapidPublicKey = () => ({
        status: 200,
        body: { publicKey: config.vapidPublicKey },
    });

    return { subscribe, unsubscribe, getVapidPublicKey };
};

module.exports = createPushSubscriptionService;