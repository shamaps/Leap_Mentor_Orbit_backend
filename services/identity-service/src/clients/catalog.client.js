const { createInternalClient } = require("@leapmentor/shared/utils/internalClient");

module.exports = createInternalClient({
    caller: "identity",
    target: "catalog",
    baseUrl: () => process.env.CATALOG_SERVICE_URL,
    token: () => process.env.IDENTITY_TO_CATALOG_TOKEN,
    timeoutMs: Number.parseInt(process.env.INTERNAL_CALL_TIMEOUT_MS, 10) || 3000,
});
