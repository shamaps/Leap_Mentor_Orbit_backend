const createServiceCompensationService = (repo, { paymentsClient, catalogClient, sessionRepo, logger }) => {
    const perform = async (action, payload, key) => {
        switch (action) {
            case "payments.release":
                return paymentsClient.post(`/internal/escrows/${payload.requestId}/release`, {
                    body: { menteeId: payload.menteeId }, idempotencyKey: key,
                });
            case "payments.slotRefund":
                return paymentsClient.post(`/internal/escrows/${payload.requestId}/slots/${payload.slotIndex}/refund`, {
                    body: { cancelledBy: payload.cancelledBy }, idempotencyKey: key,
                });
            case "catalog.slotRelease":
                return catalogClient.releaseSlot(payload, key);
            case "session.cancelSlot": {
                const catalogResult = await catalogClient.releaseSessionSlot(payload, key);
                const slot = catalogResult?.data?.slot ?? catalogResult?.slot;
                if (payload.paymentStatus !== "paid") return { slot, refund: null };
                const paymentResponse = await paymentsClient.post(
                    `/internal/escrows/${payload.requestId}/slots/${payload.slotIndex}/refund`,
                    { body: { cancelledBy: slot?.cancelledBy || payload.cancelledBy }, idempotencyKey: `${payload.requestId}:${payload.slotIndex}:refund` }
                );
                return { slot, refund: paymentResponse?.data ?? paymentResponse };
            }
            case "session.rescheduleSlot":
                return catalogClient.rescheduleSessionSlot(payload, key);
            case "session.confirmBooking":
                return catalogClient.confirmBookingSlot(payload, key);
            case "catalog.confirmSlot":
                return catalogClient.confirmSlot(payload, key);
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
            await repo.scheduleRetry(record, error);
            logger.error("Downstream operation failed; compensation queued", { action, key, error: error.message });
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
            // The release operation has its own durable retry record.
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
            await repo.scheduleRetry(record, error);
            logger.warn("Compensation retry failed", { action: record.action, key: record.key, attempt: record.attempts, error: error.message });
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
