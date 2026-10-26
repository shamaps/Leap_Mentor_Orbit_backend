const toNotificationDTO = (doc) => ({
    id: doc._id,
    _id: doc._id,
    type: doc.type,
    message: doc.message,
    isRead: doc.isRead,
    createdAt: doc.createdAt,
    link: doc.link || null,
});

const toNotificationList = (docs) => docs.map(toNotificationDTO);
module.exports = { toNotificationDTO, toNotificationList };