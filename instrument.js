require("dotenv").config();
const Sentry = require("@sentry/node");
const { sanitize } = require("./utils/sanitize");

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 1,
    sendDefaultPii: false,
    integrations: [
        Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
    ],
    _experiments: {
        enableLogs: true,
    },
    beforeSend(event) {
        // ✅ Scrub request body using your sanitize utility
        if (event.request?.data) {
            event.request.data = sanitize(event.request.data);
        }

        // ✅ Scrub user fields on the event itself
        if (event.user?.email) {
            const { maskEmail } = require("./utils/mask");
            event.user.email = maskEmail(event.user.email);
        }

        return event;
    },

    beforeSendTransaction(event) {
        // ✅ Scrub user email from traces too
        if (event.user?.email) {
            const { maskEmail } = require("./utils/mask");
            event.user.email = maskEmail(event.user.email);
        }
        return event;
    },
});