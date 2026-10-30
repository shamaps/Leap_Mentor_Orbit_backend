// Carries out the user-cascade calls (catalog / engagement / payments cleanup)
// that identity published to the stream.
const { createWorker } = require("@leapmentor/shared/utils/streams");
const { CASCADE_STREAM, CASCADE_GROUP } = require("../services/userCascade.service");

const startUserCascadeWorker = ({ userCascade, ...options }) => {
    const worker = createWorker({ stream: CASCADE_STREAM, group: CASCADE_GROUP, handlers: userCascade.handlers, ...options });
    worker.start();
    return worker;
};

module.exports = { startUserCascadeWorker };