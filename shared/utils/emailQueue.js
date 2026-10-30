// utils/emailQueue.js
// Drop-in replacement for require("./emails"): same function names, same
// arguments, but each call is queued on a Redis Stream and sent by the
// communication-service email worker (with retries and a dead-letter stream).
//
// If Redis can't be reached, or EMAIL_QUEUE_ENABLED=false, the email is sent
// directly in this process exactly as before, so turning the queue on never
// makes email delivery worse.
const config = require("../config/env");
const logger = require("./logger");
const { randomUUID } = require("node:crypto");
const EMAIL_STREAM = "stream:email";

const createEmailQueue = ({ publish, emails, enabled = true, log = logger }) => {
    const types = Object.keys(emails).filter((name) => typeof emails[name] === "function");

    const enqueueOrSend = async (type, payload) => {
        if (!enabled) return emails[type](payload);
        try {
            // The key lets `publish` safely retry an ambiguous timeout, and lets the worker skip a duplicate.
            await publish(EMAIL_STREAM, type, payload, { key: randomUUID() });
            return { queued: true };
        } catch (error) {
            log.warn("Email queue unavailable; sending directly", { type, error: error.message });
            return emails[type](payload);
        }
    };

    const queued = Object.fromEntries(types.map((type) => [type, (payload) => enqueueOrSend(type, payload)]));
    return { ...queued, EMAIL_TYPES: types };
};

// Lazy so that requiring this file never opens a Redis connection by itself.
const defaultQueue = createEmailQueue({
    publish: (...args) => require("./streams").publish(...args),
    emails: require("./emails"),
    enabled: config.emailQueueEnabled,
});

module.exports = { ...defaultQueue, EMAIL_STREAM, createEmailQueue };