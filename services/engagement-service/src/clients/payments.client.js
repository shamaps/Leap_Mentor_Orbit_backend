// services/engagement-service/src/clients/payments.client.js
const { createInternalClient } = require("@leapmentor/shared/utils/internalClient");

module.exports = createInternalClient({
    caller: "engagement",
    target: "payments",
    baseUrl: () => process.env.PAYMENTS_SERVICE_URL,
    token: () => process.env.ENGAGEMENT_TO_PAYMENTS_TOKEN,
    timeoutMs: Number.parseInt(process.env.INTERNAL_CALL_TIMEOUT_MS, 10) || 3000,
});