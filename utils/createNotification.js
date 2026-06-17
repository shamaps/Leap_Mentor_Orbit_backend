// utils/createNotification.js
const notifRepo = require("../repositories/notification.repository");
const logger = require("./logger");

const createNotification = async ({ recipient, type, title, message, metadata = {} }) => {
  try {
    logger.info("createNotification called", { recipient, type, title });
    const notif = await notifRepo.createNotification({ recipient, type, title, message, metadata });
    logger.info("Notification saved", { notificationId: notif._id });
  } catch (err) {
    logger.error("Failed to create notification", { error: err.message, stack: err.stack });
  }
};

module.exports = createNotification;