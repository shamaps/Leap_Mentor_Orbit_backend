// utils/mappers/leapRequest.mapper.js
const toLeapRequestDTO = (doc) => ({
    id: doc._id,
    _id: doc._id,
    mentee: doc.mentee,
    currentBalance: doc.currentBalance,
    status: doc.status,
    createdAt: doc.createdAt,
});

const toLeapRequestListDTO = ({ requests, pagination }) => ({
    requests: requests.map(toLeapRequestDTO),
    pagination,
});

module.exports = { toLeapRequestDTO, toLeapRequestListDTO };