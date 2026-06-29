/**
 * @fileoverview Admin service layer handling business logic for admin operations.
 */

const jwt = require("jsonwebtoken");
const AppError = require("../utils/appError");
const cache = require("../utils/cache");
const config = require("../config/env");
const { withTransaction } = require("../utils/withTransaction");
const { escapeRegex } = require("../utils/escapeRegex");
const { toAdminDTO } = require("../utils/mappers/adminUser.mapper");
const { toUserDTO } = require("../utils/mappers/user.mapper");
const { toMentorProfileDTO } = require("../utils/mappers/mentorProfile.mapper");

/**
 * Creates the admin service.
 * @param {Object} repo - The admin repository.
 * @param {Object} options - Options object.
 * @param {Object} options.logger - Logger instance.
 * @returns {Object} Admin service methods.
 */
const createAdminService = (repo, { logger }) => {
    /**
     * Generates a JWT for the admin.
     * @param {string} id - The admin user ID.
     * @returns {string} The signed JWT token.
     */
    const signToken = (id) =>
        jwt.sign({ id, role: "admin" }, config.jwtSecret, {
            expiresIn: config.jwtAdminExpiresIn,
        });

    /**
     * Sets the admin access token as an httpOnly cookie.
     * @param {Object} res - Express response object.
     * @param {string} token - The JWT token to set.
     */
    const setAdminCookie = (res, token) => {
        res.cookie("adminAccessToken", token, {
            httpOnly: true,
            secure: config.isProduction,
            sameSite: config.isProduction ? "strict" : "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: "/",
        });
    };

    // AUTH

    /**
     * Authenticates an admin and sets the auth cookie.
     * @param {Object} res - Express response object.
     * @param {string} email - Admin email.
     * @param {string} password - Admin password.
     * @returns {Promise<{admin: Object}>} The authenticated admin DTO.
     * @throws {AppError} 401 or 403 on invalid credentials or inactive account.
     */
    const loginAdmin = async (res, email, password) => {
        const admin = await repo.findAdminByEmail(email);
        if (!admin) throw new AppError(401, "Invalid credentials.");
        if (!admin.isActive) throw new AppError(403, "Admin account is deactivated");

        const isMatch = await admin.comparePassword(password);
        if (!isMatch) throw new AppError(401, "Invalid credentials");

        admin.lastLoginAt = new Date();
        await repo.saveAdmin(admin);

        const accessToken = signToken(admin._id);
        setAdminCookie(res, accessToken);

        return {
            admin: toAdminDTO(admin),
        };
    };

    // STATS

    /**
     * Fetches top-level aggregate statistics for the dashboard.
     * @returns {Promise<Object>} Aggregate statistics.
     */
    const fetchStats = async () => {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const [
            totalUsers,
            totalMentors,
            totalMentees,
            newUsersThisMonth,
            newMentorsThisMonth,
            newMenteesThisMonth,
        ] = await Promise.all([
            repo.countAllUsers({}),
            repo.countAllUsers({ roles: "mentor" }),
            repo.countAllUsers({ roles: "mentee" }),
            repo.countAllUsers({ createdAt: { $gte: startOfMonth } }),
            repo.countAllUsers({ roles: "mentor", createdAt: { $gte: startOfMonth } }),
            repo.countAllUsers({ roles: "mentee", createdAt: { $gte: startOfMonth } }),
        ]);

        return {
            totalUsers,
            totalMentors,
            totalMentees,
            newUsersThisMonth,
            newMentorsThisMonth,
            newMenteesThisMonth,
        };
    };

    /**
     * Fetches user growth statistics over the past 90 days.
     * @returns {Promise<Array<{label: string, count: number}>>} Growth data.
     */
    const fetchUserGrowth = async () => {
        const since = new Date();
        since.setDate(since.getDate() - 90);

        const growth = await repo.aggregateUserGrowth(since);

        return growth.map((g) => ({
            label: new Date(g._id).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            count: g.count,
        }));
    };

    /**
     * Fetches the top 12 mentor industries by count.
     * @returns {Promise<Array<{industry: string, count: number}>>} Industry stats.
     */
    const fetchMentorIndustryStats = async () => {
        const industries = await repo.aggregateMentorIndustries();
        return industries.map((i) => ({ industry: i._id, count: i.count }));
    };

    // USER MANAGEMENT

    /**
     * Fetches a paginated and optionally filtered list of users.
     * @param {Object} query - Filter parameters.
     * @param {string} [query.search] - Search term for name/email.
     * @param {string} [query.role] - User role ("mentor" or "mentee").
     * @param {number} [query.page=1] - Page number.
     * @param {number} [query.limit=20] - Number of items per page.
     * @param {string} [query.deleted] - Include deleted users if "true".
     * @returns {Promise<Object>} Paginated list of enriched users.
     */
    const fetchUsers = async ({ search, role, page = 1, limit = 20, deleted }) => {
        const filter = {};

        filter.isDeleted = deleted === "true" ? true : { $ne: true };

        if (role && ["mentor", "mentee"].includes(role)) {
            filter.roles = role;
        }

        if (search?.trim()) {
            const term = search.trim();
            const nameMatchIds = await repo.findUserIdsByName(term);
            const emailRegex = new RegExp(escapeRegex(term), "i");
            filter.$or = [{ _id: { $in: nameMatchIds } }, { email: emailRegex }];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const total = await repo.countUsers(filter);
        const users = await repo.findUsers(filter, skip, Number(limit));

        const userIds = users.map((u) => u._id);

        const [mentorProfiles, menteeProfiles] = await Promise.all([
            repo.findMentorProfilesByUserIds(userIds),
            repo.findMenteeProfilesByUserIds(userIds),
        ]);

        const mentorMap = Object.fromEntries(mentorProfiles.map((p) => [p.user.toString(), p]));
        const menteeMap = Object.fromEntries(menteeProfiles.map((p) => [p.user.toString(), p]));

        const enriched = users.map((u) => ({
            ...u,
            profile: mentorMap[u._id.toString()] ?? menteeMap[u._id.toString()] ?? null,
        }));

        return {
            users: enriched,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        };
    };

    /**
     * Fetches detailed information for a specific user.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<Object>} Detailed user DTO and session count.
     * @throws {AppError} 404 if the user is not found.
     */
    const fetchUserDetail = async (userId) => {
        const user = await repo.findUserById(userId);
        if (!user) throw new AppError(404, "User not found.");

        const isMentor = user.roles.includes("mentor");

        const [profile, sessionCount] = await Promise.all([
            isMentor
                ? repo.findMentorProfileByUser(userId)
                : repo.findMenteeProfileByUser(userId),
            repo.countCompletedSessions(userId),
        ]);
        return { user: toUserDTO(user), profile: toMentorProfileDTO(profile), sessionCount };
    };

    /**
     * Hard deletes a user from the database permanently.
     * @param {string} userId - The ID of the user to remove.
     * @returns {Promise<{message: string}>} Success message.
     * @throws {AppError} 404 if the user is not found.
     */
    const removeUser = async (userId) => {
        const user = await repo.findUserByIdRaw(userId);
        if (!user) throw new AppError(404, "User not found.");

        await repo.hardDeleteUser(userId);

        logger.info("Admin deleted user", { email: user.email, userId });

        return { message: `User ${user.name} (${user.email}) has been permanently deleted.` };
    };

    /**
     * Soft deletes/blocks a user.
     * @param {string} userId - The ID of the user to block.
     * @returns {Promise<{message: string}>} Success message.
     * @throws {AppError} 404 if the user is not found.
     */
    const blockUser = async (userId) => {
        const user = await repo.blockUserById(userId);
        if (!user) throw new AppError(404, "User not found.");

        logger.info("Admin blocked user", { email: user.email, userId });
        return { message: `User ${user.name} has been blocked.` };
    };

    /**
     * Unblocks a previously blocked user.
     * @param {string} userId - The ID of the user to unblock.
     * @returns {Promise<{message: string}>} Success message.
     * @throws {AppError} 404 if the user is not found.
     */
    const unblockUser = async (userId) => {
        const user = await repo.unblockUserById(userId);
        if (!user) throw new AppError(404, "User not found.");

        logger.info("Admin unblocked user", { email: user.email, userId });
        return { message: `User ${user.name} has been restored.` };
    };

    /**
     * Soft-deletes a user and cancels their pending engagements via cascade.
     * @param {string} userId - The ID of the user to delete.
     * @returns {Promise<{message: string}>} Success message.
     * @throws {AppError} 404 if the user is not found.
     */
    const deleteUser = async (userId) => {
        const user = await repo.findUserByIdRaw(userId);
        if (!user) throw new AppError(404, "User not found");
        await repo.cascadeDeleteUser(userId);
        logger.info("User soft-deleted with cascade", { userId, email: user.email });
        return { message: `User ${user.name} has been deleted.` };
    };

    // ENGAGEMENTS

    /**
     * Fetches statistics related to engagements (connect requests).
     * @returns {Promise<Object>} Engagement counts by status and total.
     */
    const fetchEngagementStats = async () => {
        const statuses = ["pending", "accepted", "rejected", "referred", "ongoing", "completed"];

        const counts = await Promise.all(statuses.map((s) => repo.countEngagementsByStatus(s)));

        const stats = Object.fromEntries(statuses.map((s, i) => [s, counts[i]]));
        stats.total = counts.reduce((a, b) => a + b, 0);

        return stats;
    };

    /**
     * Fetches a paginated and optionally filtered list of engagements.
     * @param {Object} query - Filter parameters.
     * @param {string} [query.status] - Engagement status.
     * @param {string} [query.search] - Search term for mentor/mentee name or email.
     * @param {string|Date} [query.dateFrom] - Start date filter.
     * @param {string|Date} [query.dateTo] - End date filter.
     * @param {number} [query.page=1] - Page number.
     * @param {number} [query.limit=15] - Number of items per page.
     * @returns {Promise<Object>} Paginated list of engagements.
     */
    const fetchEngagements = async ({ status, search, dateFrom, dateTo, page = 1, limit = 15 }) => {
        const filter = {};

        if (status) filter.status = status;

        if (dateFrom || dateTo) {
            filter.requestedAt = {};
            if (dateFrom) filter.requestedAt.$gte = new Date(dateFrom);
            if (dateTo) filter.requestedAt.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
        }

        if (search?.trim()) {
            const ids = await repo.findUserIdsBySearchTerm(search.trim());
            filter.$or = [{ mentor: { $in: ids } }, { mentee: { $in: ids } }];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const total = await repo.countEngagements(filter);
        const engagements = await repo.findEngagements(filter, skip, Number(limit));

        return {
            engagements,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        };
    };

    return {
        loginAdmin, fetchStats, fetchUserGrowth, fetchMentorIndustryStats,
        fetchUsers, fetchUserDetail, removeUser, blockUser, unblockUser,
        fetchEngagementStats, deleteUser, fetchEngagements,
    };
};
module.exports = createAdminService;