/**
 * services/sessionCompletion.service.js
 *
 * Single responsibility: marking a session slot as complete.
 * Isolated because it is the only slot operation that:
 * - Runs inside a Mongoose transaction
 * - Triggers escrow release
 * - Invalidates the platform stats cache
 */

const cache = require("@leapmentor/shared/utils/cache");
const { toMarkCompleteDTO } = require("@leapmentor/shared/utils/mappers/session.mapper");
const { computeProgress, buildCompleteMessage } = require("./sessionHelpers");
const AppError = require("@leapmentor/shared/utils/appError");

/**
 * Service initialization factory closure encapsulating dependencies.
 * * @param {Object} sessionRepo - Repository instance managing structural transaction queries.
 * @param {Object} compensationService - Authenticated downstream client wrapper with durable retries.
 * @param {Object} slotMutationService - Dependency processing state verification wrappers and event channels.
 * @param {Object} configOptions - System settings wrapper block.
 * @param {Object} configOptions.logger - App system logger implementation context instance.
 * @returns {Object} Encapsulated framework object containing core transaction service operations.
 */
const createSessionCompletionService = (sessionRepo, compensationService, slotMutationService, { logger }) => {

    /**
     * Executes atomic steps needed to successfully process a single appointment completion request.
     * * @param {string|import('mongoose').Types.ObjectId} connectRequestId - Connection record target pointer key.
     * @param {string|number} slotIndex - Relative positional offset tracking pointer target inside structural arrays.
     * @param {string|import('mongoose').Types.ObjectId} userId - Unique tracking hash representation mapping current user actor.
     * @throws {AppError} 400 error if cancellation locks match or double-submitting triggers verification failures.
     * @returns {Promise<Object>} Formatted Data Transfer Object summary highlighting outcome properties.
     */
    const markSlotComplete = async (connectRequestId, slotIndex, userId) => {
        let connectRequest, idx, bothMarked, allComplete, releaseResult,
            totalSlots, completedSlots, progress, isMentee;

        try {
            ({ connectRequest, idx } = await slotMutationService.loadAndValidateSlot({
                connectRequestId, slotIndex, userId, allowCompleted: true,
            }));

            const slot = connectRequest.selectedSlots[idx];

            if (slot.status === "cancelled") {
                throw new AppError(400, "Cannot mark a cancelled slot as complete");
            }
            isMentee = connectRequest.mentee.toString() === userId.toString();
            const confirmKey = `${connectRequestId}:${idx}:${userId}`;
            await compensationService.run("catalog.confirmSlot", {
                requestId: String(connectRequestId), slotIndex: idx, userId: String(userId),
            }, `catalog:confirm:${confirmKey}`);

            // Catalog owns the slot confirmation write. Re-read the aggregate
            // after its response before deciding whether escrow can be released.
            connectRequest = await sessionRepo.findSessionDocument(connectRequestId);
            if (!connectRequest) throw new AppError(404, "Session not found after confirmation");
            const confirmedSlot = connectRequest.selectedSlots[idx];
            bothMarked = Boolean(confirmedSlot?.menteeMarked && confirmedSlot?.mentorMarked);

            const computed = computeProgress(connectRequest.selectedSlots);
            totalSlots = computed.totalSlots;
            completedSlots = computed.completedSlots;
            progress = computed.progress;

            allComplete =
                computed.activeSlots.length > 0 &&
                computed.activeSlots.every((s) => s.menteeMarked && s.mentorMarked);

            releaseResult = null;
            if (allComplete) {
                releaseResult = await compensationService.run("payments.release", {
                    requestId: String(connectRequestId), menteeId: String(connectRequest.mentee),
                }, `${connectRequestId}:release`);
            }

        } catch (err) {
            logger.error("markSlotComplete downstream operation failed", {
                error: err.message,
                stack: err.stack,
            });
            throw err;
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
