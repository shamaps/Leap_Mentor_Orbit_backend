// services/engagement-service/src/realtime/socketBridge.js
//
// Drop-in replacement for the monolith's socket/socketHandler for services that do NOT run Socket.IO.
// Only the communication service holds socket connections (ARCHITECTURE.md, D3), so instead of
// emitting directly this bridge forwards each event to it:
//
//     POST {COMMUNICATION_SERVICE_URL}/internal/events      header: X-Internal-Token
//
// It exposes the same surface the engagement code already uses:
//     emitToUser(userId, event, data)
//     io.to(room).except(socketId).emit(event, data)
//
// Delivery is best-effort and never throws or blocks a request: real-time events are UI hints,
// the underlying data is already saved. If COMMUNICATION_SERVICE_URL is not set, events are skipped.
const logger = require("@leapmentor/shared/utils/logger");
const { createInternalClient } = require("@leapmentor/shared/utils/internalClient");

const communicationClient = createInternalClient({
    caller: "engagement",
    target: "communication",
    baseUrl: () => process.env.COMMUNICATION_SERVICE_URL,
    token: () => process.env.ENGAGEMENT_TO_COMMUNICATION_TOKEN,
    timeoutMs: 2000,
    retries: 0,
});

let warned = false;

const post = (body) => {
    if (!process.env.COMMUNICATION_SERVICE_URL || !process.env.ENGAGEMENT_TO_COMMUNICATION_TOKEN) {
        if (!warned) {
            warned = true;
            logger.warn("Communication service URL or caller token not set: real-time events are disabled");
        }
        return false;
    }
    communicationClient.post("/internal/events", { body })
        .catch((err) => logger.warn("Realtime event delivery failed", { event: body.event, error: err.message }));
    return true;
};

const emitToUser = (userId, event, data) =>
    post({ target: "user", userId: String(userId), event, data });

// Same chain shape as Socket.IO: io.to(room).except(socketId).emit(event, data)
const io = {
    to(room) {
        const exclude = [];
        const chain = {
            except(socketId) { if (socketId) exclude.push(socketId); return chain; },
            emit(event, data) { return post({ target: "room", room: String(room), exclude, event, data }); },
        };
        return chain;
    },
};

module.exports = { emitToUser, io };
