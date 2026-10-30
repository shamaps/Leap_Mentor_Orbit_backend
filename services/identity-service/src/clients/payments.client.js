const { createInternalClient } = require("@leapmentor/shared/utils/internalClient");

module.exports = createInternalClient({
    caller: "identity",
    target: "payments",
    baseUrl: () => process.env.PAYMENTS_SERVICE_URL,
    token: () => process.env.IDENTITY_TO_PAYMENTS_TOKEN,
    timeoutMs: Number.parseInt(process.env.INTERNAL_CALL_TIMEOUT_MS, 10) || 3000,
});
