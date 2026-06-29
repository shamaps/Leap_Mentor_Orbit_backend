// repositories/notification.repository.js
const Notification = require("../models/Notification");

/**
 * Searches the core database tracking collection to return up to 50 records sorted sequentially.
 * * @function findNotificationsByUser
 * @param {any} userId - Target query client user identifier index key.
 * @returns {import('mongoose').Query} Mongoose query selection instance array limited to 50 documents.
 */
const findNotificationsByUser = (userId) =>
    Notification.find({ recipient: userId }).sort({ createdAt: -1 }).limit(50);

/**
 * Records a new structural notification parameter envelope row onto data registers.
 * * @async
 * @function createNotification
 * @param {Object} inputFields - Creation requirements specification properties.
 * @param {any} inputFields.recipient - Reference indicator linking basic user accounts.
 * @param {string} inputFields.type - Functional system taxonomy grouping code value.
 * @param {string} inputFields.title - Literal summary header label value.
 * @param {string} inputFields.message - Core body notification textual value.
 * @param {Object} [inputFields.metadata={}] - Optional additional contextual data dictionaries.
 * @returns {Promise<Object>} Freshly instantiated written Mongoose document row.
 */
const createNotification = async ({ recipient, type, title, message, metadata = {} }) => {
    return await Notification.create({ recipient, type, title, message, metadata });
};

/**
 * Executes mass modifications flagging all unviewed profile entries matching a specific user as read.
 * * @function markAllReadByUser
 * @param {any} userId - Dynamic target owner selection criteria parameter.
 * @returns {import('mongoose').Query} Mongoose update execution summary report tracking altered parameters.
 */
const markAllReadByUser = (userId) =>
    Notification.updateMany({ recipient: userId, read: false }, { read: true });

/**
 * Alters status indicators over a single targeted document row within secure boundaries.
 * * @function markOneReadByUser
 * @param {string} notificationId - Target primary database unique lookup selector index.
 * @param {any} userId - Secure context reference verifying recipient ownership properties.
 * @returns {import('mongoose').Query} Mongoose update query response template validation values.
 */
const markOneReadByUser = (notificationId, userId) =>
    Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        { read: true }
    );

/**
 * Discards a unique row tracking node element physically from databases.
 * * @function deleteOneByUser
 * @param {string} notificationId - Target lookup locator index selection string.
 * @param {any} userId - Recipient validation matching verification index pointer.
 * @returns {import('mongoose').Query} Deleted information row parameter data metrics.
 */
const deleteOneByUser = (notificationId, userId) =>
    Notification.findOneAndDelete({ _id: notificationId, recipient: userId });

/**
 * Purges the entire notification records footprint belonging to the specified recipient user account.
 * * @function deleteAllByUser
 * @param {any} userId - Target lookup primary indicator index locator string key.
 * @returns {import('mongoose').Query} Operational database removal metrics summary tracking counts.
 */
const deleteAllByUser = (userId) =>
    Notification.deleteMany({ recipient: userId });

module.exports = {
    findNotificationsByUser,
    createNotification,
    markAllReadByUser,
    markOneReadByUser,
    deleteOneByUser,
    deleteAllByUser,
};