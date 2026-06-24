// backend/repositories/admin.repository.js
const User = require("../models/User");
const AdminUser = require("../models/AdminUser");
const MentorProfile = require("../models/MentorProfile");
const MenteeProfile = require("../models/MenteeProfile");
const ConnectRequest = require("../models/ConnectRequest");
const Wallet = require("../models/Wallet");
const { withTransaction } = require("../utils/withTransaction");
const { escapeRegex } = require("../utils/escapeRegex");
const { findUsersByName } = require("./userSearch.repository");
const logger = require("../utils/logger");
// AUTH

const findAdminByEmail = (email) =>
    AdminUser.findOne({ email });

const saveAdmin = (admin) =>
    admin.save();

// STATS

const countAllUsers = (filter = {}) =>
    User.countDocuments(filter).setOptions({ ignoreIsDeleted: true });

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

const aggregateMentorIndustries = () =>
    MentorProfile.aggregate([
        { $match: { industry: { $exists: true, $nin: [null, ""] } } },
        { $group: { _id: "$industry", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 12 },
    ]);

// USER MANAGEMENT

// USER MANAGEMENT — Atlas name search.
// includeDeleted:true here because the deleted-filter is applied separately
// in admin.service.fetchUsers (filter.isDeleted), so this only resolves name matches.
const findUserIdsByName = async (term) => {
    const users = await findUsersByName(term, { includeDeleted: true });
    return users.map((u) => u._id);
};

const countUsers = (filter) =>
    User.countDocuments(filter, { ignoreIsDeleted: true });

const findUsers = (filter, skip, limit) =>
    User.find(filter, null, { ignoreIsDeleted: true })
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

const findMentorProfilesByUserIds = (userIds) =>
    MentorProfile.find({ user: { $in: userIds } })
        .select("user isProfileComplete isProfilePublished")
        .lean();

const findMenteeProfilesByUserIds = (userIds) =>
    MenteeProfile.find({ user: { $in: userIds } })
        .select("user isProfileComplete isProfilePublished")
        .lean();

const findUserById = (userId) =>
    User.findById(userId)
        .select("-password")
        .setOptions({ ignoreIsDeleted: true })
        .lean();

const findMentorProfileByUser = (userId) =>
    MentorProfile.findOne({ user: userId })
        .select("verificationStatus isProfileComplete isProfilePublished bio skills currentRole company industry yearsOfExperience averageRating totalSessions profilePicture")
        .lean();

const findMenteeProfileByUser = (userId) =>
    MenteeProfile.findOne({ user: userId })
        .select("isProfileComplete isProfilePublished bio goals profilePicture learningInterests")
        .lean();

const countCompletedSessions = (userId) =>
    ConnectRequest.countDocuments({
        $or: [{ mentor: userId }, { mentee: userId }],
        status: "completed",
    });

const hardDeleteUser = async (userId) => {
    logger.debug("hardDeleteUser called", { userId: userId?.toString() });
    const results = await Promise.allSettled([
        User.findByIdAndDelete(userId),
        MentorProfile.findOneAndDelete({ user: userId }),
        MenteeProfile.findOneAndDelete({ user: userId }),
        ConnectRequest.deleteMany({ $or: [{ mentor: userId }, { mentee: userId }] }),
    ]);
    const failures = results.filter(r => r.status === "rejected");
    if (failures.length) {
        failures.forEach(f =>
            logger.error("hardDeleteUser partial failure", { error: f.reason?.message, userId: userId?.toString() })
        );
    }
    logger.debug("hardDeleteUser complete", { userId: userId?.toString(), failures: failures.length });
};

const findUserByIdRaw = (userId) =>
    User.findById(userId);

const blockUserById = (userId) =>
    User.findByIdAndUpdate(
        userId,
        { isDeleted: true, deletedAt: new Date() },
        { new: true },
    );

const unblockUserById = (userId) =>
    User.findOneAndUpdate(
        { _id: userId },
        { isDeleted: false, deletedAt: null },
        { new: true, ignoreIsDeleted: true },
    );
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
// ENGAGEMENTS

const countEngagementsByStatus = (status) =>
    ConnectRequest.countDocuments({ status });

const countEngagements = (filter) =>
    ConnectRequest.countDocuments(filter);

const findEngagements = (filter, skip, limit) =>
    ConnectRequest.find(filter)
        .populate("mentor", "name email")
        .populate("mentee", "name email")
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

// Atlas Search (user_name_search index) — name only.
// Email search stays as a separate regex branch since email isn't indexed in Atlas.
const findUserIdsBySearchTerm = async (term) => {
    const [nameMatches, emailMatchUsers] = await Promise.all([
        findUsersByName(term, { includeDeleted: true }),
        User.find({ email: { $regex: escapeRegex(term), $options: "i" } }, null, { ignoreIsDeleted: true })
            .select("_id")
            .lean(),
    ]);
    const ids = new Map();
    nameMatches.forEach((u) => ids.set(u._id.toString(), u._id));
    emailMatchUsers.forEach((u) => ids.set(u._id.toString(), u._id));
    return [...ids.values()];
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
    // engagements
    countEngagementsByStatus,
    countEngagements,
    findEngagements,
    findUserIdsBySearchTerm,
};