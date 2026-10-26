/**
 * @fileoverview Admin repository handling database operations for the admin layer.
 */

const User = require("@leapmentor/shared/models/User");
const AdminUser = require("@leapmentor/shared/models/AdminUser");
const MentorProfile = require("@leapmentor/shared/models/MentorProfile");
const MenteeProfile = require("@leapmentor/shared/models/MenteeProfile");
const ConnectRequest = require("@leapmentor/shared/models/ConnectRequest");
const Wallet = require("@leapmentor/shared/models/Wallet");
const { withTransaction } = require("@leapmentor/shared/utils/withTransaction");
const { escapeRegex } = require("@leapmentor/shared/utils/escapeRegex");
const { findUsersByName } = require("./userSearch.repository");
const logger = require("@leapmentor/shared/utils/logger");
const { idToString } = require("@leapmentor/shared/utils/idToString");

// AUTH

/**
 * Finds an admin user by email.
 * @param {string} email - The email to search for.
 * @returns {Promise<Object|null>} The admin document.
 */
const findAdminByEmail = (email) =>
    AdminUser.findOne({ email });

/**
 * Saves changes to an admin user document.
 * @param {Object} admin - The admin mongoose document to save.
 * @returns {Promise<Object>} The saved document.
 */
const saveAdmin = (admin) =>
    admin.save();

// STATS

/**
 * Counts all users matching an optional filter, ignoring soft deletes.
 * @param {Object} [filter={}] - Mongoose query filter.
 * @returns {Promise<number>} Total count.
 */
const countAllUsers = (filter = {}) =>
    User.countDocuments(filter).setOptions({ ignoreIsDeleted: true });

/**
 * Aggregates user growth day by day since a given date.
 * @param {Date} since - The start date for aggregation.
 * @returns {Promise<Array<Object>>} Aggregation results.
 */
const aggregateUserGrowth = (since) =>
    User.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

/**
 * Aggregates the top 12 industries among mentors.
 * @returns {Promise<Array<Object>>} Aggregation results.
 */
const aggregateMentorIndustries = () =>
    MentorProfile.aggregate([
        { $match: { industry: { $exists: true, $nin: [null, ""] } } },
        { $group: { _id: "$industry", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 12 },
    ]);

// USER MANAGEMENT

/**
 * Finds user IDs by performing a text search on user names.
 * @param {string} term - Search term.
 * @returns {Promise<Array<string>>} Array of user IDs.
 */
const findUserIdsByName = async (term) => {
    const users = await findUsersByName(term, { includeDeleted: true });
    return users.map((u) => idToString(u._id));
};

/**
 * Counts total users matching a filter for pagination.
 * @param {Object} filter - Mongoose query filter.
 * @returns {Promise<number>} Total count.
 */
const countUsers = (filter) =>
    User.countDocuments(filter, { ignoreIsDeleted: true });

/**
 * Finds users based on a filter with pagination.
 * @param {Object} filter - Mongoose query filter.
 * @param {number} skip - Number of records to skip.
 * @param {number} limit - Max number of records to return.
 * @returns {Promise<Array<Object>>} Array of user documents.
 */
const findUsers = (filter, skip, limit) =>
    User.find(filter, null, { ignoreIsDeleted: true })
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

/**
 * Finds mentor profiles matching an array of user IDs.
 * @param {Array<string>} userIds - Array of user ObjectIds.
 * @returns {Promise<Array<Object>>} Array of mentor profile documents.
 */
const findMentorProfilesByUserIds = (userIds) =>
    MentorProfile.find({ user: { $in: userIds } })
        .select("user isProfileComplete isProfilePublished")
        .lean();

/**
 * Finds mentee profiles matching an array of user IDs.
 * @param {Array<string>} userIds - Array of user ObjectIds.
 * @returns {Promise<Array<Object>>} Array of mentee profile documents.
 */
const findMenteeProfilesByUserIds = (userIds) =>
    MenteeProfile.find({ user: { $in: userIds } })
        .select("user isProfileComplete isProfilePublished")
        .lean();

/**
 * Finds a single user by ID, ignoring soft deletes.
 * @param {string} userId - The user ID.
 * @returns {Promise<Object|null>} The user document.
 */
const findUserById = (userId) =>
    User.findById(userId)
        .select("-password")
        .setOptions({ ignoreIsDeleted: true })
        .lean();

/**
 * Finds a single mentor profile by user ID.
 * @param {string} userId - The user ID.
 * @returns {Promise<Object|null>} The mentor profile document.
 */
const findMentorProfileByUser = (userId) =>
    MentorProfile.findOne({ user: userId })
        .select("verificationStatus isProfileComplete isProfilePublished bio skills currentRole company industry yearsOfExperience averageRating totalSessions profilePicture")
        .lean();

/**
 * Finds a single mentee profile by user ID.
 * @param {string} userId - The user ID.
 * @returns {Promise<Object|null>} The mentee profile document.
 */
const findMenteeProfileByUser = (userId) =>
    MenteeProfile.findOne({ user: userId })
        .select("isProfileComplete isProfilePublished bio goals profilePicture learningInterests")
        .lean();

/**
 * Counts the total number of completed sessions for a specific user.
 * @param {string} userId - The user ID.
 * @returns {Promise<number>} Count of completed sessions.
 */
const countCompletedSessions = (userId) =>
    ConnectRequest.countDocuments({
        $or: [{ mentor: userId }, { mentee: userId }],
        status: "completed",
    });

/**
 * Hard deletes a user and completely removes related data.
 * @param {string} userId - The user ID to delete.
 * @returns {Promise<void>}
 */
const hardDeleteUser = async (userId) => {
    logger.debug("hardDeleteUser called", { userId: idToString(userId) });
    const results = await Promise.allSettled([
        User.findByIdAndDelete(userId),
        MentorProfile.findOneAndDelete({ user: userId }),
        MenteeProfile.findOneAndDelete({ user: userId }),
        ConnectRequest.deleteMany({ $or: [{ mentor: userId }, { mentee: userId }] }),
    ]);
    const failures = results.filter(r => r.status === "rejected");
    if (failures.length) {
        failures.forEach(f =>
            logger.error("hardDeleteUser partial failure", { error: f.reason?.message, userId: idToString(userId) })
        );
    }
    logger.debug("hardDeleteUser complete", { userId: idToString(userId), failures: failures.length });
};

/**
 * Finds a raw user document by ID (includes password, etc.).
 * @param {string} userId - The user ID.
 * @returns {Promise<Object|null>} The raw mongoose document.
 */
const findUserByIdRaw = (userId) =>
    User.findById(userId);

/**
 * Soft deletes a user (blocks them).
 * @param {string} userId - The user ID to block.
 * @returns {Promise<Object|null>} The updated user document.
 */
const blockUserById = (userId) =>
    User.findByIdAndUpdate(
        userId,
        { isDeleted: true, deletedAt: new Date() },
        { new: true },
    );

/**
 * Unblocks a soft-deleted user.
 * @param {string} userId - The user ID to unblock.
 * @returns {Promise<Object|null>} The updated user document.
 */
const unblockUserById = (userId) =>
    User.findOneAndUpdate(
        { _id: userId },
        { isDeleted: false, deletedAt: null },
        { new: true, ignoreIsDeleted: true },
    );

/**
 * Soft-deletes a user, their profiles, wallet, and cancels pending connect requests.
 * Wrapped in a MongoDB transaction.
 * @param {string} userId - The user ID to cascade delete.
 * @returns {Promise<void>}
 */
const cascadeDeleteUser = async (userId) => {
    await withTransaction(async (session) => {
        const now = new Date();
        const patch = { $set: { isDeleted: true, deletedAt: now } };
        await Promise.all([
            User.findByIdAndUpdate(userId, patch, { session }),
            MentorProfile.findOneAndUpdate({ user: userId }, patch, { session }),
            MenteeProfile.findOneAndUpdate({ user: userId }, patch, { session }),
            Wallet.findOneAndUpdate({ user: userId }, patch, { session }),
            ConnectRequest.updateMany(
                { $or: [{ mentor: userId }, { mentee: userId }], status: "pending" },
                { $set: { isDeleted: true, deletedAt: now, status: "cancelled" } },
                { session }
            ),
        ]);
    }, "admin.deleteUser");
};



module.exports = {
    // auth
    findAdminByEmail,
    saveAdmin,
    // stats
    countAllUsers,
    aggregateUserGrowth,
    aggregateMentorIndustries,
    // users
    countUsers,
    findUserIdsByName,
    findUsers,
    findMentorProfilesByUserIds,
    findMenteeProfilesByUserIds,
    findUserById,
    findMentorProfileByUser,
    findMenteeProfileByUser,
    countCompletedSessions,
    hardDeleteUser,
    findUserByIdRaw,
    blockUserById,
    unblockUserById,
    cascadeDeleteUser,
};