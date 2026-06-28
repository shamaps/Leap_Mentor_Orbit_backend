/**
 * services/session.service.js
 *
 * Facade — composes slotMutation.service.js and sessionCompletion.service.js
 * into a single surface for the session controller and DI container.
 *
 * Responsibilities are split as:
 *   sessionHelpers.js        — pure helpers, no I/O (guards, parsers, progress)
 *   slotMutation.service.js  — getSlots, setMeetingLink, addSlot, cancelSlot,
 *                              rescheduleSlot, getMentorAvailability
 *   sessionCompletion.service.js — markSlotComplete (transaction + escrow)
 */

const createSlotMutationService = require("./slotMutation.service");
const createSessionCompletionService = require("./sessionCompletion.service");

const createSessionService = (sessionRepo, escrowRepo, { logger }) => {
    const slotMutation = createSlotMutationService(sessionRepo, escrowRepo, { logger });
    const completion = createSessionCompletionService(sessionRepo, escrowRepo, slotMutation, { logger });

    return {
        // reads
        getSlots: slotMutation.getSlots,
        getMentorAvailability: slotMutation.getMentorAvailability,

        // slot mutations
        setMeetingLink: slotMutation.setMeetingLink,
        addSlot: slotMutation.addSlot,
        cancelSlot: slotMutation.cancelSlot,
        rescheduleSlot: slotMutation.rescheduleSlot,

        // completion (transaction + escrow)
        markSlotComplete: completion.markSlotComplete,
    };
};

module.exports = createSessionService;