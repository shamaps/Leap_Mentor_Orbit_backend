const toFeedbackDTO = (doc) => ({
    id: doc._id,
    _id: doc._id,
    rating: doc.rating,
    comment: doc.comment,
    createdAt: doc.createdAt,
    from: doc.from ? { id: doc.from._id, name: doc.from.name } : null,
    to: doc.to ? { id: doc.to._id, name: doc.to.name } : null,
});
module.exports = { toFeedbackDTO };