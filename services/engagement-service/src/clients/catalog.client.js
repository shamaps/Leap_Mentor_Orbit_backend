// services/engagement-service/src/clients/catalog.client.js

const { createInternalClient } = require("@leapmentor/shared/utils/internalClient");

const client = createInternalClient({
    caller: "engagement",
    target: "catalog",
    baseUrl: () => process.env.CATALOG_SERVICE_URL,
    token: () => process.env.ENGAGEMENT_TO_CATALOG_TOKEN,
    timeoutMs: Number.parseInt(process.env.INTERNAL_CALL_TIMEOUT_MS, 10) || 3000,
});

// Catalog-owned writes. Engagement callers can adopt these during the session
// mutation cutover; each mutation supplies a stable key so transport retries
// are safe as well as domain-level repeats.
module.exports = {
    ...client,
    lockSlot: (payload, idempotencyKey) => client.post("/internal/slots/lock", {
        body: payload,
        idempotencyKey: idempotencyKey || `slot:lock:${payload.mentorId}:${payload.date}:${payload.startTime}:${payload.endTime}:${payload.menteeId}`,
    }),
    releaseSlot: (payload, idempotencyKey) => client.post("/internal/slots/release", {
        body: payload,
        idempotencyKey: idempotencyKey || `slot:release:${payload.mentorId}:${payload.date}:${payload.startTime}:${payload.endTime}:${payload.menteeId}`,
    }),
    confirmSlot: ({ requestId, slotIndex, userId }, idempotencyKey) => client.post(
        `/internal/sessions/${requestId}/slots/${slotIndex}/confirm`,
        { body: { userId }, idempotencyKey: idempotencyKey || `slot:confirm:${requestId}:${slotIndex}:${userId}` }
    ),
    updateMentorRating: ({ mentorId, avgRating, ratingCount }, idempotencyKey) => client.put(
        `/internal/mentors/${mentorId}/rating`,
        { body: { avgRating, ratingCount }, idempotencyKey: idempotencyKey || `mentor:rating:${mentorId}:${ratingCount}` }
    ),
    getMentorAvailability: (mentorId) => client.get(`/internal/mentors/${mentorId}/availability`),
    releaseSessionSlot: ({ requestId, slotIndex, cancelledBy, reason }, idempotencyKey) => client.post(
        `/internal/sessions/${requestId}/slots/${slotIndex}/release`,
        { body: { cancelledBy, reason }, idempotencyKey: idempotencyKey || `session:release:${requestId}:${slotIndex}` }
    ),
    rescheduleSessionSlot: ({ requestId, slotIndex, userId, date, startTime, endTime, day }, idempotencyKey) => client.post(
        `/internal/sessions/${requestId}/slots/${slotIndex}/reschedule`,
        { body: { userId, date, startTime, endTime, day }, idempotencyKey: idempotencyKey || `session:reschedule:${requestId}:${slotIndex}` }
    ),
    confirmBookingSlot: ({ requestId, mentorId, confirmedSlot }, idempotencyKey) => client.post(
        `/internal/requests/${requestId}/confirm-slot`,
        { body: { mentorId, confirmedSlot }, idempotencyKey: idempotencyKey || `request:confirm-slot:${requestId}` }
    ),
};
