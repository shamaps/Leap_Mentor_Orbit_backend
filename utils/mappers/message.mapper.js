// utils/mappers/message.mapper.js
const toMessageDTO = (doc) => ({
    id: doc._id,
    _id: doc._id,
    content: doc.content,
    sender: doc.sender
        ? { id: doc.sender._id, _id: doc.sender._id, name: doc.sender.name, email: doc.sender.email }
        : doc.sender,
    connectRequest: doc.connectRequest,
    readAt: doc.readAt || null,
    createdAt: doc.createdAt,
});

const toMessageListDTO = (data) => ({
    messages: data.messages.map(toMessageDTO),
    pagination: data.pagination,
    totalCount: data.totalCount,
    page: data.page,
    limit: data.limit,
    hasMore: data.hasMore,
});

const toUnreadCountDTO = (count) => ({ unreadCount: count });

module.exports = { toMessageDTO, toMessageListDTO, toUnreadCountDTO };