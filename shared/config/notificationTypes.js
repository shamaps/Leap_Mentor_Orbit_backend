// shared/config/notificationTypes.js
// Single source of truth for in-app notification types. Used by the Notification
// model (enum) and by the notification worker (event validation)
const NOTIFICATION_TYPES = Object.freeze([
    "connect_request_received",
    "connect_request_accepted",
    "connect_request_declined",
    "upcoming_session",
    "new_message",
    "session_completed",
    "new_review",
    "support_resolved",
]);

module.exports = { NOTIFICATION_TYPES };