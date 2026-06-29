/**
 * services/sessionHelpers.js
 *
 * Pure helpers and shared guards for session slot operations.
 * No I/O — all functions are synchronous or accept injected deps.
 * Extracted from session.service.js to satisfy SRP and LOC limits.
 */

const AppError = require("../utils/appError");

// ── Meeting link validation ───────────────────────────────────────────────────

/**
 * List of domain names explicitly supported for video configurations.
 * @type {Array<string>}
 */
const ALLOWED_MEETING_DOMAINS = [
    "meet.google.com",
    "zoom.us",
    "teams.microsoft.com",
    "whereby.com",
    "meet.jit.si",
    "webex.com",
];

/**
 * Validates whether a given URL string uses HTTPS and maps to an allowed meeting provider.
 * * @param {string} rawUrl - The raw web address to validate.
 * @returns {boolean} True if the link is from an explicitly permitted service, false otherwise.
 */
const isValidMeetingLink = (rawUrl) => {
    try {
        const url = new URL(rawUrl);
        if (url.protocol !== "https:") return false;
        const host = url.hostname.toLowerCase();
        return ALLOWED_MEETING_DOMAINS.some(
            (d) => host === d || host.endsWith(`.${d}`)
        );
    } catch {
        return false;
    }
};

// ── Participant / access guards ───────────────────────────────────────────────

/**
 * Verifies if a user ID belongs to either the mentor or the mentee of a transaction request.
 * * @param {Object} connectRequest - The connection request object containing references.
 * @param {string|Object} connectRequest.mentor - Mentor ID string or object.
 * @param {string|Object} connectRequest.mentee - Mentee ID string or object.
 * @param {string|Object} userId - The user ID to evaluate.
 * @returns {boolean} True if the user is a valid party to the request.
 */
const isParticipant = (connectRequest, userId) => {
    const uid = userId.toString();
    return (
        connectRequest.mentor.toString() === uid ||
        connectRequest.mentee.toString() === uid
    );
};

/**
 * Asserts that a connection request exists and that the acting user has access permissions.
 * Throws a specific HTTP status exception if validation boundaries are crossed.
 * * @param {Object|null} connectRequest - The session metadata object.
 * @param {string|Object} userId - The unique identifier of the requesting user.
 * @param {string} connectRequestId - Contextual request parameter ID for diagnostics.
 * @throws {AppError} 404 error if request is missing; 403 error if user is unauthenticated or unauthorized.
 */
const assertSessionAccess = (connectRequest, userId, connectRequestId) => {
    if (!connectRequest) {
        throw new AppError(404, "Session not found");
    }
    if (!isParticipant(connectRequest, userId)) {
        throw new AppError(403, "Not authorized");
    }
};

/**
 * Validates that a session's high-level state status is marked active or ongoing.
 * * @param {Object} connectRequest - The application model instance context.
 * @param {string} connectRequest.status - Status state tracking string.
 * @throws {AppError} 400 error if the status state fails validation checks.
 */
const assertOngoing = (connectRequest) => {
    if (connectRequest.status !== "ongoing") {
        throw new AppError(400, "Session is not active");
    }
};

// ── Slot index parsing ────────────────────────────────────────────────────────

/**
 * Parse and validate a slotIndex param.
 * Returns { slot, idx } or null if invalid.
 * * @param {Object} connectRequest - The request data container containing booking arrays.
 * @param {Array<Object>} connectRequest.selectedSlots - List of booked individual slot entries.
 * @param {string|number} slotIndex - Array position lookup key.
 * @returns {Object|null} An object bundling the resolved slot details and numerical array index, or null.
 */
const parseSlotIndex = (connectRequest, slotIndex) => {
    const idx = Number.parseInt(slotIndex);
    if (
        Number.isNaN(idx) ||
        idx < 0 ||
        idx >= connectRequest.selectedSlots.length
    ) {
        return null;
    }
    return { slot: connectRequest.selectedSlots[idx], idx };
};

// ── Progress computation ──────────────────────────────────────────────────────

/**
 * Compute the progress summary over active (non-cancelled) slots.
 * * @param {Array<Object>} selectedSlots - Complete list of slot data records.
 * @returns {Object} Metric payload breaking down counts, active list array, and percentage values.
 */
const computeProgress = (selectedSlots) => {
    const activeSlots = selectedSlots.filter((s) => s.status !== "cancelled");
    const completedCount = activeSlots.filter(
        (s) => s.menteeMarked && s.mentorMarked
    ).length;
    return {
        activeSlots,
        completedCount,
        totalSlots: activeSlots.length,
        completedSlots: completedCount,
        progress:
            activeSlots.length > 0
                ? Math.round((completedCount / activeSlots.length) * 100)
                : 0,
    };
};

// ── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Weekday list mappings.
 * @type {Array<string>}
 */
const DAYS = [
    "Sunday", "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday",
];

/**
 * Resolves the string name representation of a given calendar weekday string.
 * * @param {string} dateStr - Date string formatted without timestamp values (YYYY-MM-DD).
 * @returns {string} String name matching standard weekday listings.
 */
const dayFromDate = (dateStr) =>
    DAYS[new Date(`${dateStr}T00:00:00`).getDay()];

// ── Mark-complete pure helpers ────────────────────────────────────────────────

/**
 * Builds the completion message (avoids nested ternary).
 * * @param {boolean} allComplete - Flag indicating whether every session slot is complete.
 * @param {boolean} bothMarked - Flag indicating if both target sides signed off on this specific slot.
 * @param {boolean} isMentee - Identity flag tracking whether caller is the client.
 * @returns {string} Informative notification message text.
 */
const buildCompleteMessage = (allComplete, bothMarked, isMentee) => {
    if (allComplete) return "All sessions complete! Tokens released to mentor.";
    if (bothMarked) return "Session marked complete by both parties.";
    const waiting = isMentee ? "mentor" : "mentee";
    return `Session marked complete. Waiting for ${waiting} to confirm.`;
};

/**
 * Validates and applies the completion mark for one role.
 * Modifies mutable properties by safe object reference assignments.
 * * @param {Object} params - Functional arguments container payload.
 * @param {Object} params.slot - Read-only operational context evaluation mirror.
 * @param {Object} params.slotRef - Directly mutable object pointer bound to permanent database arrays.
 * @param {boolean} params.isMentee - Boolean flag tracking whether user is a receiver.
 * @param {boolean} params.isMentor - Boolean flag tracking whether user is a provider.
 * @throws {AppError} 400 error if execution targets a status state that is already checked.
 */
const applyMark = ({ slot, slotRef, isMentee, isMentor }) => {
    if (isMentee) {
        if (slot.menteeMarked) {
            throw new AppError(400, "You have already marked this session complete");
        }
        slotRef.menteeMarked = true;
    }
    if (isMentor) {
        if (slot.mentorMarked) {
            throw new AppError(400, "You have already marked this session complete");
        }
        slotRef.mentorMarked = true;
    }
};

module.exports = {
    isValidMeetingLink,
    isParticipant,
    assertSessionAccess,
    assertOngoing,
    parseSlotIndex,
    computeProgress,
    dayFromDate,
    buildCompleteMessage,
    applyMark,
};