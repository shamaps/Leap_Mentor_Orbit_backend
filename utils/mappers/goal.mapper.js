// goal.mapper.js
const toGoalDTO = (doc) => ({
    id: doc._id,
    _id: doc._id,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
});
const toMilestoneDTO = (doc) => ({
    id: doc._id,
    _id: doc._id,
    title: doc.title,
    isCompleted: doc.isCompleted,
    completedAt: doc.completedAt,
    dueDate: doc.dueDate,
});
module.exports = { toGoalDTO, toMilestoneDTO };