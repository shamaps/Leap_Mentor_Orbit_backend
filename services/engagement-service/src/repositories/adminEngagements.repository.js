// services/engagement-service/src/repositories/adminEngagements.repository.js
const User = require("@leapmentor/shared/models/User");
const ConnectRequest = require("@leapmentor/shared/models/ConnectRequest");
const { findUsersByName } = require("@leapmentor/shared/repositories/userSearch.repository");
const { escapeRegex } = require("@leapmentor/shared/utils/escapeRegex");
const { idToString } = require("@leapmentor/shared/utils/idToString");

/** Counts engagements with a given status. */
const countEngagementsByStatus = (status) =>
    ConnectRequest.countDocuments({ status });

/** Counts engagements matching a filter (for pagination). */
const countEngagements = (filter) =>
    ConnectRequest.countDocuments(filter);

/** Finds engagements by filter with pagination and populated mentor/mentee. */
const findEngagements = (filter, skip, limit) =>
    ConnectRequest.find(filter)
        .populate("mentor", "name email")
        .populate("mentee", "name email")
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

/** Finds user IDs by name (Atlas Search) or email (regex). */
const findUserIdsBySearchTerm = async (term) => {
    const [nameMatches, emailMatchUsers] = await Promise.all([
        findUsersByName(term, { includeDeleted: true }),
        User.find({ email: { $regex: escapeRegex(term), $options: "i" } }, null, { ignoreIsDeleted: true })
            .select("_id")
            .lean(),
    ]);
    const ids = new Map();
    nameMatches.forEach((u) => ids.set(idToString(u._id), u._id));
    emailMatchUsers.forEach((u) => ids.set(idToString(u._id), u._id));
    return [...ids.values()];
};

module.exports = {
    countEngagementsByStatus,
    countEngagements,
    findEngagements,
    findUserIdsBySearchTerm,
};