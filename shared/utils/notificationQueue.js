// shared/utils/notificationQueue.js
const crypto = require("node:crypto");
const logger = require("./logger");

const NOTIFICATION_STREAM = "stream:notification";
const NOTIFICATION_EVENT = "notification.create";

const buildEventId = ({ type, recipient, dedupeKey }) =>
    dedupeKey ? `${type}:${recipient}:${dedupeKey}` : crypto.randomUUID();

const createNotificationPublisher = ({ publish, log = logger } = {}) => {
    const send = publish || ((...args) => require("./streams").publish(...args));

    return async ({ recipient, type, title, message, metadata = {}, dedupeKey } = {}) => {
        try {
            if (!recipient) throw new Error("recipient is required");

            const recipientId = String(recipient);
            const eventId = buildEventId({ type, recipient: recipientId, dedupeKey });
            const payload = {
                eventId,
                recipient: recipientId,
                type,
                title,
                message,
                // ObjectIds and Dates become plain JSON values; undefined fields are dropped.
                metadata: JSON.parse(JSON.stringify(metadata ?? {})),
            };

            await send(NOTIFICATION_STREAM, NOTIFICATION_EVENT, payload, { key: eventId });
            return { queued: true, eventId };
        } catch (err) {
            log.error("Failed to queue notification", {
                error: err.message,
                type,
                recipient: recipient == null ? recipient : String(recipient),
            });
            return undefined;
        }
    };
};

const publishNotification = createNotificationPublisher();

module.exports = {
    NOTIFICATION_STREAM,
    NOTIFICATION_EVENT,
    buildEventId,
    createNotificationPublisher,
    publishNotification,
};