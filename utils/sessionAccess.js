// utils/sessionAccess.js
const { ACTIVE_SESSION_STATUSES } = require("../config/constants");

/**
 * Validates that userId is a participant in an active session.
 * @param {Function} findSessionParticipants - repo fn that returns { mentor, mentee, status }
 * @param {string} connectRequestId
 * @param {string} userId
 * @returns {{ valid: boolean, reason?: string, status?: number, uploaderRole?: string, sessionStatus?: string }}
 */
const validateSessionAccess = async (findSessionParticipants, connectRequestId, userId) => {
    const request = await findSessionParticipants(connectRequestId);
    if (!request) return { valid: false, reason: "Session not found", status: 404 };
    if (!ACTIVE_SESSION_STATUSES.includes(request.status))
        return { valid: false, reason: "Session is not active", status: 400 };

    const uid = userId.toString();
    const isMentor = request.mentor.toString() === uid;
    const isMentee = request.mentee.toString() === uid;
    if (!isMentor && !isMentee)
        return { valid: false, reason: "Not authorized", status: 403 };

    return {
        valid: true,
        uploaderRole: isMentor ? "mentor" : "mentee",
        sessionStatus: request.status,
    };
};

module.exports = { validateSessionAccess };