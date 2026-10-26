// utils/mappers/support.mapper.js
const toSupportMessageDTO = (doc) => ({
    id: doc._id,
    _id: doc._id,
    email: doc.email,
    subject: doc.subject,
    message: doc.message,
    role: doc.role,
    status: doc.status,
    createdAt: doc.createdAt,
});

const toSupportListDTO = ({ messages, pagination }) => ({
    messages: messages.map(toSupportMessageDTO),
    pagination,
});

module.exports = { toSupportMessageDTO, toSupportListDTO };