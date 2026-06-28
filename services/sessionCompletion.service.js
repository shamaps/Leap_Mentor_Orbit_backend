/**
 * services/sessionCompletion.service.js
 *
 * Single responsibility: marking a session slot as complete.
 * Isolated because it is the only slot operation that:
 *   - Runs inside a Mongoose transaction
 *   - Triggers escrow release
 *   - Invalidates the platform stats cache
 */

const mongoose = require("mongoose");
const releaseEscrow = require("../utils/releaseEscrow");
const cache = require("../utils/cache");
const { toMarkCompleteDTO } = require("../utils/mappers/session.mapper");
const { computeProgress, buildCompleteMessage, applyMark } = require("./sessionHelpers");
const AppError = require("../utils/appError");

const createSessionCompletionService = (sessionRepo, escrowRepo, slotMutationService, { logger }) => {

    const markSlotComplete = async (connectRequestId, slotIndex, userId) => {
        const mongoSession = await mongoose.startSession();
        mongoSession.startTransaction();

        let connectRequest, idx, bothMarked, allComplete, releaseResult,
            totalSlots, completedSlots, progress, isMentee;

        try {
            ({ connectRequest, idx } = await slotMutationService.loadAndValidateSlot({
                connectRequestId, slotIndex, userId, mongoSession,
            }));

            const slot = connectRequest.selectedSlots[idx];

            if (slot.status === "cancelled") {
                throw new AppError(400, "Cannot mark a cancelled slot as complete");
            }
            if (slot.menteeMarked && slot.mentorMarked) {
                throw new AppError(400, "This session is already marked complete by both parties");
            }

            const isMentor = connectRequest.mentor.toString() === userId.toString();
            isMentee = connectRequest.mentee.toString() === userId.toString();

            applyMark({ slot, slotRef: connectRequest.selectedSlots[idx], isMentee, isMentor });

            bothMarked =
                connectRequest.selectedSlots[idx].menteeMarked &&
                connectRequest.selectedSlots[idx].mentorMarked;

            if (bothMarked) {
                connectRequest.selectedSlots[idx].completedAt = new Date();
            }

            connectRequest.markModified("selectedSlots");
            await connectRequest.save({ session: mongoSession });

            const computed = computeProgress(connectRequest.selectedSlots);
            totalSlots = computed.totalSlots;
            completedSlots = computed.completedSlots;
            progress = computed.progress;

            allComplete =
                computed.activeSlots.length > 0 &&
                computed.activeSlots.every((s) => s.menteeMarked && s.mentorMarked);

            releaseResult = null;
            if (allComplete) {
                releaseResult = await releaseEscrow(escrowRepo, connectRequestId, mongoSession);
            }

            await mongoSession.commitTransaction();

        } catch (err) {
            await mongoSession.abortTransaction();
            logger.error("markSlotComplete transaction failed", {
                error: err.message,
                stack: err.stack,
            });
            throw err;
        } finally {
            mongoSession.endSession();
        }

        // Post-transaction — session is closed, nothing can roll back here
        if (allComplete) {
            try {
                await cache.del(cache.NS.PLATFORM_SETTINGS);
            } catch (cacheErr) {
                logger.warn("cache.del PLATFORM_SETTINGS failed after markSlotComplete", {
                    error: cacheErr.message,
                });
            }
        }

        const socketPayload = {
            connectRequestId,
            slots: connectRequest.selectedSlots,
            totalSlots,
            completedSlots,
            progress,
            allComplete,
        };
        slotMutationService.emitSlotUpdate(connectRequest, socketPayload);

        const message = buildCompleteMessage(allComplete, bothMarked, isMentee);

        return toMarkCompleteDTO({
            slot: connectRequest.selectedSlots[idx],
            slotIndex: idx,
            bothMarked,
            allComplete,
            completedSlots,
            totalSlots,
            progress,
            escrowRelease: releaseResult,
            message,
        });
    };

    return { markSlotComplete };
};

module.exports = createSessionCompletionService;