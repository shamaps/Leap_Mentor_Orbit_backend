const { createInternalClient } = require("@leapmentor/shared/utils/internalClient");

module.exports = createInternalClient({
    caller: "identity",
    target: "engagement",
    baseUrl: () => process.env.ENGAGEMENT_SERVICE_URL,
    token: () => process.env.IDENTITY_TO_ENGAGEMENT_TOKEN,
    timeoutMs: Number.parseInt(process.env.INTERNAL_CALL_TIMEOUT_MS, 10) || 3000,
});
