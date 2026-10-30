// Sends queued emails. Producers (identity, catalog, engagement, payments) publish
// { type, payload } to the email stream; this worker looks `type` up in the email
// template barrel and runs it. Only functions exported by shared/utils/emails can
// run, so a stream message can never execute arbitrary code.
const emails = require("@leapmentor/shared/utils/emails");
const config = require("@leapmentor/shared/config/env");
const logger = require("@leapmentor/shared/utils/logger");
const { createWorker } = require("@leapmentor/shared/utils/streams");
const { EMAIL_STREAM } = require("@leapmentor/shared/utils/emailQueue");

const EMAIL_GROUP = "email-workers";

const buildHandlers = (templates = emails) =>
    Object.fromEntries(
        Object.entries(templates)
            .filter(([, fn]) => typeof fn === "function")
            .map(([name, fn]) => [name, (payload) => fn(payload)])
    );

const startEmailWorker = (options = {}) => {
    if (!config.emailWorkerEnabled) {
        logger.info("Email worker disabled (EMAIL_WORKER_ENABLED=false)");
        return { stop: async () => { } };
    }
    const worker = createWorker({ stream: EMAIL_STREAM, group: EMAIL_GROUP, handlers: buildHandlers(), ...options });
    worker.start();
    return worker;
};

module.exports = { startEmailWorker, buildHandlers, EMAIL_GROUP };