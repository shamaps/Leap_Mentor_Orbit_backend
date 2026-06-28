/**
 * services/sessionHelpers.js
 *
 * Pure helpers and shared guards for session slot operations.
 * No I/O — all functions are synchronous or accept injected deps.
 * Extracted from session.service.js to satisfy SRP and LOC limits.
 */

const AppError = require("../utils/appError");

// ── Meeting link validation ───────────────────────────────────────────────────

const ALLOWED_MEETING_DOMAINS = [
    "meet.google.com",
    "zoom.us",
    "teams.microsoft.com",
    "whereby.com",
    "meet.jit.si",
    "webex.com",
];

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

const isParticipant = (connectRequest, userId) => {
    const uid = userId.toString();
    return (
        connectRequest.mentor.toString() === uid ||
        connectRequest.mentee.toString() === uid
    );
};

const assertSessionAccess = (connectRequest, userId, connectRequestId) => {
    if (!connectRequest) {
        throw new AppError(404, "Session not found");
    }
    if (!isParticipant(connectRequest, userId)) {
        throw new AppError(403, "Not authorized");
    }
};

const assertOngoing = (connectRequest) => {
    if (connectRequest.status !== "ongoing") {
        throw new AppError(400, "Session is not active");
    }
};

// ── Slot index parsing ────────────────────────────────────────────────────────

/**
 * Parse and validate a slotIndex param.
 * Returns { slot, idx } or null if invalid.
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

const DAYS = [
    "Sunday", "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday",
];

const dayFromDate = (dateStr) =>
    DAYS[new Date(`${dateStr}T00:00:00`).getDay()];

// ── Mark-complete pure helpers ────────────────────────────────────────────────

/** Builds the completion message (avoids nested ternary). */
const buildCompleteMessage = (allComplete, bothMarked, isMentee) => {
    if (allComplete) return "All sessions complete! Tokens released to mentor.";
    if (bothMarked) return "Session marked complete by both parties.";
    const waiting = isMentee ? "mentor" : "mentee";
    return `Session marked complete. Waiting for ${waiting} to confirm.`;
};

/** Validates and applies the completion mark for one role. */
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