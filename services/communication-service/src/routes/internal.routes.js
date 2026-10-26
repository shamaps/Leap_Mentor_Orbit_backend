// services/communication-service/src/routes/internal.routes.js
// Callers: engagement's src/realtime/socketBridge.js (and any service that needs to push a real-time event).
const express = require("express");
const logger = require("@leapmentor/shared/utils/logger");
const socketHandler = require("../socket/socketHandler");
const { requireInternalAuth } = require("@leapmentor/shared/middleware/internalAuth");

const router = express.Router();

const EVENT_NAME = /^[A-Za-z0-9_:.-]{1,64}$/;

router.use(requireInternalAuth({ service: "communication", callers: ["engagement"] }));

router.post("/events", (req, res) => {
    const { target, userId, room, exclude, event, data } = req.body || {};
    if (typeof event !== "string" || !EVENT_NAME.test(event)) {
        return res.status(400).json({ success: false, message: "Invalid event name" });
    }

    if (target === "user") {
        if (typeof userId !== "string" || !userId) {
            return res.status(400).json({ success: false, message: "userId is required" });
        }
        const delivered = socketHandler.emitToUser ? socketHandler.emitToUser(userId, event, data) : false;
        return res.status(202).json({ success: true, delivered: !!delivered });
    }

    if (target === "room") {
        if (typeof room !== "string" || !room) {
            return res.status(400).json({ success: false, message: "room is required" });
        }
        if (!socketHandler.io) return res.status(202).json({ success: true, delivered: false });
        const skip = Array.isArray(exclude) ? exclude.filter((id) => typeof id === "string") : [];
        let to = socketHandler.io.to(room);
        if (skip.length) to = to.except(skip);
        to.emit(event, data);
        return res.status(202).json({ success: true, delivered: true });
    }

    return res.status(400).json({ success: false, message: 'target must be "user" or "room"' });
});

module.exports = router;
