const STUCK_AFTER_ATTEMPTS = 10;
const RETRYABLE_4XX = new Set([408, 425, 429]); 
const classifyFailure = (action, error) => {
    if (error?.meta?.upstream !== "payments") return "retry";

    const status = Number(error.status);

    // Retry timeouts, non-4xx errors, and explicitly retryable 4xx responses.
    if (!Number.isInteger(status) || status < 400 || status >= 500 || RETRYABLE_4XX.has(status)) {
        return "retry";
    }

    // A release 409 means there is nothing left to release.
    if (action === "payments.release" && status === 409) return "settled";

    // Other Payments 4xx errors are terminal and need operator attention.
    return "failed";
};
const createServiceCompensationService = (repo, { paymentsClient, catalogClient, sessionRepo, sessionOperations, logger }) => {
    const recordFailure = async (record, error) => {
        const outcome = classifyFailure(record.action, error);
        const context = {
            action: record.action,
            key: record.key,
            attempt: record.attempts,
            status: error?.status,
            error: error?.message,
        };

        if (outcome === "settled") {
            const result = {
                skipped: "already_settled",
                reason: String(error.message),
            };
            await repo.complete(record._id, result);
            logger.warn("Downstream work was already settled; compensation closed", context);
            return { outcome, result };
        }

        if (outcome === "failed") {
            await repo.fail(record, error);
            logger.error("Compensation rejected by downstream service and needs manual action", context);
            return { outcome };
        }

        await repo.scheduleRetry(record, error);
        if ((record.attempts || 0) >= STUCK_AFTER_ATTEMPTS) {
            logger.error("Compensation is stuck and needs attention", context);
        }
        return { outcome };
    };
    const applyReleaseOutcome = async (requestId) => {
        if (!sessionRepo) return;

        await sessionRepo.markRequestCompleted(requestId);

        const request = await sessionRepo.findSessionForRead(requestId);
        if (!request?.mentor) return;

        await catalogClient.recordCompletedSession({
            mentorId: String(request.mentor),
            requestId: String(requestId),
        });
    };

    const applyRefundOutcome = async (requestId, refund) => {
        if (!sessionRepo || refund?.escrowStatus !== "refunded") return;

        await sessionRepo.markPaymentRefunded(requestId);
    };

 const perform = async (action, payload, key) => {
        switch (action) {
            case "payments.release": {
                const response = await paymentsClient.post(
                    `/internal/escrows/${payload.requestId}/release`,
                    {
                        body: { menteeId: payload.menteeId },
                        idempotencyKey: key,
                    }
                );

                await applyReleaseOutcome(payload.requestId);
                return response;
            }

            case "payments.slotRefund": {
                const response = await paymentsClient.post(
                    `/internal/escrows/${payload.requestId}/slots/${payload.slotIndex}/refund`,
                    {
                        body: { cancelledBy: payload.cancelledBy },
                        idempotencyKey: key,
                    }
                );

                await applyRefundOutcome(
                    payload.requestId,
                    response?.data ?? response
                );

                return response;
            }
            case "catalog.slotRelease":
                return catalogClient.releaseSlot(payload, key);
            case "session.cancelSlot": {
                    const released = await sessionOperations.releaseSessionSlot(payload);
                    const slot = released?.data?.slot ?? released?.slot;
                    const {
                        escrowSlotIndex = payload.slotIndex,
                        escrowSlotId = null,
                        refundable = true,
                    } = released ?? {};

                    if (payload.paymentStatus !== "paid" || !refundable) {
                        return { slot, refund: null };
                    }

                    const paymentResponse = await paymentsClient.post(
                        `/internal/escrows/${payload.requestId}/slots/${escrowSlotIndex}/refund`,
                        {
                            body: {
                                cancelledBy: slot?.cancelledBy || payload.cancelledBy,
                                ...(escrowSlotId && { slotId: escrowSlotId }),
                            },
                            idempotencyKey:
                                `${payload.requestId}:${escrowSlotId || escrowSlotIndex}:refund`,
                        }
                    );

                    const refund = paymentResponse?.data ?? paymentResponse;
                    await applyRefundOutcome(payload.requestId, refund);

                    return { slot, refund };
                }
            case "session.rescheduleSlot":
                return sessionOperations.rescheduleSessionSlot(payload);
            case "session.confirmBooking":
                return sessionOperations.confirmBookingSlot(payload);
            case "catalog.confirmSlot":
                return sessionOperations.confirmSlot(payload);
            case "catalog.mentorRating":
                return catalogClient.updateMentorRating(payload, key);
            default:
                throw new Error(`Unsupported compensation action: ${action}`);
        }
    };

    const getMentorAvailability = async (mentorId) => {
        const response = await catalogClient.getMentorAvailability(String(mentorId));
        return response?.data ?? null;
    };

    const run = async (action, payload, key) => {
        const record = await repo.enqueue(key, action, payload);
        if (record.status === "completed") return record.result;
        try {
            const response = await perform(record.action, record.payload, record.key);
            const result = response?.data ?? response;
            if (action === "catalog.confirmSlot") await releaseEscrowIfComplete(payload);
            await repo.complete(record._id, result);
            return result;
        } catch (error) {
            const { outcome, result } = await recordFailure(record, error);

            if (outcome === "settled") return result;

            if (outcome === "retry") {
                logger.error("Downstream operation failed; compensation queued", {
                    action,
                    key,
                    error: error.message,
                });
            }

            throw error;
        }

    };

    const releaseEscrowIfComplete = async ({ requestId, menteeId }) => {
        if (!sessionRepo) return;
        const request = await sessionRepo.findSessionForRead(requestId);
        if (!request) return;
        const active = (request.selectedSlots || []).filter((slot) => slot.status !== "cancelled");
        if (!active.length || !active.every((slot) => slot.menteeMarked && slot.mentorMarked)) return;
        try {
            await run("payments.release", { requestId: String(requestId), menteeId: String(menteeId) }, `${requestId}:release`);
        } catch (error) {
            logger.warn("Completed session escrow release queued for retry", { requestId: String(requestId), error: error.message });
        }
    };

    const retryRecord = async (record) => {
        try {
            const response = await perform(record.action, record.payload, record.key);
            const result = response?.data ?? response;
            if (record.action === "catalog.confirmSlot") await releaseEscrowIfComplete(record.payload);
            await repo.complete(record._id, result);
            logger.info("Compensation completed", { action: record.action, key: record.key, attempt: record.attempts });
        } catch (error) {
            const { outcome } = await recordFailure(record, error);

            if (outcome === "retry") {
                logger.warn("Compensation retry failed", {
                    action: record.action,
                    key: record.key,
                    attempt: record.attempts,
                    error: error.message,
                });
            }
        }

    };

    let running = false;
    const drain = async () => {
        if (running) return;
        running = true;
        try {
            for (let count = 0; count < 25; count += 1) {
                const record = await repo.claimNext();
                if (!record) break;
                await retryRecord(record);
            }
        } catch (error) {
            logger.error("Compensation sweeper failed", { error: error.message });
        } finally {
            running = false;
        }
    };

    const start = () => {
        const timer = setInterval(drain, 5000);
        timer.unref?.();
        void drain();
        return () => clearInterval(timer);
    };

    return { run, drain, start, getMentorAvailability };
};

module.exports = createServiceCompensationService;