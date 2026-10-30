const ConnectRequest = require("@leapmentor/shared/models/ConnectRequest");

const involving = (userId) => ({ $or: [{ mentor: userId }, { mentee: userId }] });

const deleteRequestsForUser = async (userId) => {
    const result = await ConnectRequest.deleteMany(involving(userId));
    return { requests: result.deletedCount ?? 0 };
};

// Accepted, ongoing and completed ones
// keep their state because money or history may be attached to them.
const cancelPendingRequestsForUser = async (userId, now = new Date()) => {
    const result = await ConnectRequest.updateMany(
        { ...involving(userId), status: "pending" },
        { $set: { isDeleted: true, deletedAt: now, status: "cancelled" } }
    );
    return { requests: result.modifiedCount ?? 0 };
};

module.exports = { deleteRequestsForUser, cancelPendingRequestsForUser };