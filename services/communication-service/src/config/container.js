// services/communication-service/src/config/container.js
// Dependency wiring for the communication service only (subset of the monolith's config/container.js).
const logger = require("@leapmentor/shared/utils/logger");

// ── Repositories
const messageRepo = require("../repositories/message.repository");
// Shared with every service that creates notifications (phase 1, see ARCHITECTURE.md 4a)
const notificationRepo = require("@leapmentor/shared/repositories/notification.repository");

// ── Service factories
const createMessageService = require("../services/message.service");
const createNotificationService = require("../services/notification.service");

// ── Controller factories
const createMessageController = require("../controllers/message.controller");
const createNotificationController = require("../controllers/notification.controller");

// ── Wire services
const messageService = createMessageService(messageRepo, { logger });
const notificationService = createNotificationService(notificationRepo, { logger });

// ── Wire controllers
module.exports = {
    messageController: createMessageController(messageService, { logger }),
    notificationController: createNotificationController(notificationService, { logger }),
};
