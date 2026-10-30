// Creates notifications requested by other services. 
// Communication is the only service that writes the Notification collection.
//
// Failure handling:
//   - invalid event            -> retryable:false, goes straight to the dead-letter stream
//   - duplicate eventId (11000)-> treated as success, no second insert, no second emit
//   - database/network failure -> thrown as-is, so the worker retries it with backoff
//   - socket emit failure      -> logged only; the notification is already saved
const config = require("@leapmentor/shared/config/env");
const logger = require("@leapmentor/shared/utils/logger");
const { NOTIFICATION_TYPES } = require("@leapmentor/shared/config/notificationTypes");
const { createWorker } = require("@leapmentor/shared/utils/streams");
const { NOTIFICATION_STREAM, NOTIFICATION_EVENT } = require("@leapmentor/shared/utils/notificationQueue");

const NOTIFICATION_GROUP = "notification-workers";
const SOCKET_EVENT = "new_notification";
const OBJECT_ID = /^[0-9a-f]{24}$/i;

const permanent = (message) => Object.assign(new Error(message), { retryable: false });

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isText = (value, max) => typeof value === "string" && value.length > 0 && value.length <= max;

// Returns only the fields we know about; anything else on the event is ignored.
const validateEvent = (data) => {
    if (!isPlainObject(data)) throw permanent("Invalid notification event: payload must be an object");

    const { eventId, recipient, type, title, message, metadata = {} } = data;
    const problems = [];
    if (!isText(eventId, 200)) problems.push("eventId");
    if (typeof recipient !== "string" || !OBJECT_ID.test(recipient)) problems.push("recipient");
    if (!NOTIFICATION_TYPES.includes(type)) problems.push("type");
    if (!isText(title, 200)) problems.push("title");
    if (!isText(message, 1000)) problems.push("message");
    if (!isPlainObject(metadata)) problems.push("metadata");

    if (problems.length) throw permanent(`Invalid notification event: ${problems.join(", ")}`);
    return { eventId, recipient, type, title, message, metadata };
};

const toSocketPayload = (notification) =>
    typeof notification?.toJSON === "function" ? notification.toJSON() : notification;

// repo and getEmitToUser can be injected for tests; by default they are loaded on first use.
const createNotificationHandler = ({ repo, getEmitToUser, log = logger } = {}) => async (data) => {
    const event = validateEvent(data);
    const notificationRepo = repo || require("@leapmentor/shared/repositories/notification.repository");

    let notification;
    try {
        notification = await notificationRepo.createNotification(event);
    } catch (err) {
        if (err?.code === 11000) {
            log.info("Duplicate notification event ignored", { eventId: event.eventId });
            return { duplicate: true };
        }
        if (err?.name === "ValidationError" || err?.name === "CastError") throw permanent(err.message);
        throw err;
    }

    try {
        const emitToUser = getEmitToUser ? getEmitToUser() : require("../socket/socketHandler").emitToUser;
        if (emitToUser) emitToUser(event.recipient, SOCKET_EVENT, toSocketPayload(notification));
    } catch (err) {
        log.warn("Notification socket emit failed", { eventId: event.eventId, error: err.message });
    }

    return { created: true };
};

const buildHandlers = (options = {}) => ({ [NOTIFICATION_EVENT]: createNotificationHandler(options) });

const startNotificationWorker = (options = {}) => {
    if (config.notificationWorkerEnabled === false) {
        logger.info("Notification worker disabled (NOTIFICATION_WORKER_ENABLED=false)");
        return { stop: async () => { } };
    }
    const worker = createWorker({ stream: NOTIFICATION_STREAM, group: NOTIFICATION_GROUP, handlers: buildHandlers(), ...options });
    worker.start();
    return worker;
};

module.exports = {
    startNotificationWorker,
    buildHandlers,
    createNotificationHandler,
    validateEvent,
    NOTIFICATION_GROUP,
    SOCKET_EVENT,
};