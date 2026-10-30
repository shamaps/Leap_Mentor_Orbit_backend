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
    recordCompletedSession: ({ mentorId, requestId }) =>
        client.post(
            `/internal/mentors/${mentorId}/completed-sessions`,
            {
                body: { requestId },
                idempotencyKey: `mentor:completed-session:${requestId}`,
            }
        ),
    updateMentorRating: ({ mentorId, avgRating, ratingCount }, idempotencyKey) => client.put(
        `/internal/mentors/${mentorId}/rating`,
        { body: { avgRating, ratingCount }, idempotencyKey: idempotencyKey || `mentor:rating:${mentorId}:${ratingCount}` }
    ),
    getMentorAvailability: (mentorId) => client.get(`/internal/mentors/${mentorId}/availability`),
};