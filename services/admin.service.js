// backend/services/admin.service.js
const jwt = require("jsonwebtoken");
const AppError = require("../utils/appError");
const { toUserDTO } = require("../utils/mappers/user.mapper");
const { toMentorProfileDTO } = require("../utils/mappers/mentorProfile.mapper");
const createAdminService = (repo, { logger }) => {
//Token helper 
const signToken = (id) =>
    jwt.sign({ id, role: "admin" }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_ADMIN_EXPIRES_IN || "7d",
    });

// Set admin token as httpOnly cookie 
// Same pattern as regular user auth — token never goes in response body
const setAdminCookie = (res, token) => {
    res.cookie("adminAccessToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,   
        path: "/",
    });
};


// AUTH


const loginAdmin = async (res, email, password) => {   // ← res added to set cookie
    const admin = await repo.findAdminByEmail(email);
    if (!admin) throw new AppError(401, "Invalid credentials.");
    if (!admin.isActive) throw new AppError(403, "Admin account is deactivated");

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) throw new AppError(401, "Invalid credentials");

    admin.lastLoginAt = new Date();
    await repo.saveAdmin(admin);

    const accessToken = signToken(admin._id);
    setAdminCookie(res, accessToken);   // ← set as httpOnly cookie, not in response body

    return {
        // accessToken intentionally NOT returned — it is in the httpOnly cookie
        admin: {
            _id: admin._id,
            name: admin.name,
            email: admin.email,
            isSuperAdmin: admin.isSuperAdmin,
            lastLoginAt: admin.lastLoginAt,
        },
    };
};


// STATS


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

const fetchUserGrowth = async () => {
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const growth = await repo.aggregateUserGrowth(since);

    return growth.map((g) => ({
        label: new Date(g._id).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        count: g.count,
    }));
};

const fetchMentorIndustryStats = async () => {
    const industries = await repo.aggregateMentorIndustries();
    return industries.map((i) => ({ industry: i._id, count: i.count }));
};


// USER MANAGEMENT


const fetchUsers = async ({ search, role, page = 1, limit = 20, deleted }) => {
    const filter = {};

    filter.isDeleted = deleted === "true" ? true : { $ne: true };

    if (role && ["mentor", "mentee"].includes(role)) {
        filter.roles = role;
    }

    if (search?.trim()) {
        const regex = new RegExp(search.trim(), "i");
        filter.$or = [{ name: regex }, { email: regex }];
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

const removeUser = async (userId) => {
    const user = await repo.findUserByIdRaw(userId);
    if (!user) throw new AppError(404, "User not found.");

    await repo.hardDeleteUser(userId);

    logger.info("Admin deleted user", { email: user.email, userId });

    return { message: `User ${user.name} (${user.email}) has been permanently deleted.` };
};

const blockUser = async (userId) => {
    const user = await repo.blockUserById(userId);
    if (!user) throw new AppError(404, "User not found.");

    logger.info("Admin blocked user", { email: user.email, userId });
    return { message: `User ${user.name} has been blocked.` };
};

const unblockUser = async (userId) => {
    const user = await repo.unblockUserById(userId);
    if (!user) throw new AppError(404, "User not found.");

    logger.info("Admin unblocked user", { email: user.email, userId });
    return { message: `User ${user.name} has been restored.` };
};


// ENGAGEMENTS


const fetchEngagementStats = async () => {
    const statuses = ["pending", "accepted", "rejected", "referred", "ongoing", "completed"];

    const counts = await Promise.all(statuses.map((s) => repo.countEngagementsByStatus(s)));

    const stats = Object.fromEntries(statuses.map((s, i) => [s, counts[i]]));
    stats.total = counts.reduce((a, b) => a + b, 0);

    return stats;
};

const fetchEngagements = async ({ status, search, dateFrom, dateTo, page = 1, limit = 15 }) => {
    const filter = {};

    if (status) filter.status = status;

    if (dateFrom || dateTo) {
        filter.requestedAt = {};
        if (dateFrom) filter.requestedAt.$gte = new Date(dateFrom);
        if (dateTo) filter.requestedAt.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    }

    if (search?.trim()) {
        const regex = new RegExp(search.trim(), "i");
        const ids = await repo.findUserIdsBySearchTerm(regex);
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
        fetchEngagementStats, fetchEngagements,
    };
};
module.exports = createAdminService;