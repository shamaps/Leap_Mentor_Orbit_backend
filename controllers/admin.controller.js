// backend/controllers/admin.controller.js
const jwt            = require("jsonwebtoken");
const AdminUser      = require("../models/AdminUser");
const User           = require("../models/User");
const MentorProfile  = require("../models/MentorProfile");
const MenteeProfile  = require("../models/MenteeProfile");
const ConnectRequest = require("../models/ConnectRequest");

// ── Token helper ──────────────────────────────────────────────
const signToken = (id) =>
  jwt.sign({ id, role: "admin" }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

// ═════════════════════════════════════════════════════════════
// AUTH
// ═════════════════════════════════════════════════════════════

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required." });

    const admin = await AdminUser.findOne({ email });
    if (!admin) return res.status(401).json({ message: "Invalid credentials." });
    if (!admin.isActive) return res.status(403).json({ message: "Admin account is deactivated." });

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials." });

    admin.lastLoginAt = new Date();
    await admin.save();

    const token = signToken(admin._id);
    return res.status(200).json({
      success: true,
      token,
      admin: {
        _id:          admin._id,
        name:         admin.name,
        email:        admin.email,
        isSuperAdmin: admin.isSuperAdmin,
        lastLoginAt:  admin.lastLoginAt,
      },
    });
  } catch (err) {
    console.error("❌ adminLogin error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

const adminMe = async (req, res) => {
  return res.status(200).json({ admin: req.admin });
};

// ═════════════════════════════════════════════════════════════
// STATS
// ═════════════════════════════════════════════════════════════

const getStats = async (req, res) => {
  try {
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
      User.countDocuments(),
      User.countDocuments({ roles: "mentor" }),
      User.countDocuments({ roles: "mentee" }),
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      User.countDocuments({ roles: "mentor", createdAt: { $gte: startOfMonth } }),
      User.countDocuments({ roles: "mentee", createdAt: { $gte: startOfMonth } }),
    ]);

    return res.status(200).json({
      totalUsers,
      totalMentors,
      totalMentees,
      newUsersThisMonth,
      newMentorsThisMonth,
      newMenteesThisMonth,
    });
  } catch (err) {
    console.error("❌ getStats error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

const getUserGrowth = async (req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const growth = await User.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id:   { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const formatted = growth.map((g) => ({
      label: new Date(g._id).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: g.count,
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch growth data" });
  }
};

// ── NEW: Mentor Industry Distribution ─────────────────────────
const getMentorIndustryStats = async (req, res) => {
  try {
    const industries = await MentorProfile.aggregate([
      {
        $match: {
          industry: { $exists: true, $ne: null, $ne: "" },
        },
      },
      {
        $group: {
          _id:   "$industry",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]);

    const formatted = industries.map((i) => ({
      industry: i._id,
      count:    i.count,
    }));

    return res.status(200).json(formatted);
  } catch (err) {
    console.error("❌ getMentorIndustryStats error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

// ═════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ═════════════════════════════════════════════════════════════

const getUsers = async (req, res) => {
  try {
    const { search, role, page = 1, limit = 20 } = req.query;

    const filter = {};

    if (role && ["mentor", "mentee"].includes(role)) {
      filter.roles = role;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [{ name: regex }, { email: regex }];
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await User.countDocuments(filter);

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const userIds = users.map((u) => u._id);

    const [mentorProfiles, menteeProfiles] = await Promise.all([
      MentorProfile.find({ user: { $in: userIds } })
        .select("user isProfileComplete isProfilePublished")
        .lean(),
      MenteeProfile.find({ user: { $in: userIds } })
        .select("user isProfileComplete isProfilePublished")
        .lean(),
    ]);

    const mentorMap = Object.fromEntries(mentorProfiles.map((p) => [p.user.toString(), p]));
    const menteeMap = Object.fromEntries(menteeProfiles.map((p) => [p.user.toString(), p]));

    const enriched = users.map((u) => ({
      ...u,
      profile: mentorMap[u._id.toString()] || menteeMap[u._id.toString()] || null,
    }));

    return res.status(200).json({
      users: enriched,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error("❌ getUsers error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

const getUserDetail = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select("-password").lean();
    if (!user) return res.status(404).json({ message: "User not found." });

    const isMentor = user.roles.includes("mentor");

    const [profile, sessionCount] = await Promise.all([
      isMentor
        ? MentorProfile.findOne({ user: userId }).lean()
        : MenteeProfile.findOne({ user: userId }).lean(),
      ConnectRequest.countDocuments({
        $or: [{ mentor: userId }, { mentee: userId }],
        status: "completed",
      }),
    ]);

    return res.status(200).json({ user, profile, sessionCount });
  } catch (err) {
    console.error("❌ getUserDetail error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    await Promise.all([
      User.findByIdAndDelete(userId),
      MentorProfile.findOneAndDelete({ user: userId }),
      MenteeProfile.findOneAndDelete({ user: userId }),
      ConnectRequest.deleteMany({
        $or: [{ mentor: userId }, { mentee: userId }],
      }),
    ]);

    console.log(`🗑️  Admin deleted user: ${user.email} (${userId})`);

    return res.status(200).json({
      success: true,
      message: `User ${user.name} (${user.email}) has been permanently deleted.`,
    });
  } catch (err) {
    console.error("❌ deleteUser error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

// ═════════════════════════════════════════════════════════════
// ENGAGEMENTS
// ═════════════════════════════════════════════════════════════

const getEngagementStats = async (req, res) => {
  try {
    const statuses = ["pending", "accepted", "rejected", "referred", "ongoing", "completed"];

    const counts = await Promise.all(
      statuses.map((s) => ConnectRequest.countDocuments({ status: s }))
    );

    const stats = Object.fromEntries(statuses.map((s, i) => [s, counts[i]]));
    stats.total = counts.reduce((a, b) => a + b, 0);

    return res.status(200).json(stats);
  } catch (err) {
    console.error("❌ getEngagementStats error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

const getEngagements = async (req, res) => {
  try {
    const { status, search, dateFrom, dateTo, page = 1, limit = 15 } = req.query;

    const filter = {};

    if (status) filter.status = status;

    if (dateFrom || dateTo) {
      filter.requestedAt = {};
      if (dateFrom) filter.requestedAt.$gte = new Date(dateFrom);
      if (dateTo)   filter.requestedAt.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      const matchingUsers = await User.find({
        $or: [{ name: regex }, { email: regex }],
      })
        .select("_id")
        .lean();

      const ids = matchingUsers.map((u) => u._id);
      filter.$or = [{ mentor: { $in: ids } }, { mentee: { $in: ids } }];
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await ConnectRequest.countDocuments(filter);

    const engagements = await ConnectRequest.find(filter)
      .populate("mentor", "name email")
      .populate("mentee", "name email")
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return res.status(200).json({
      engagements,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error("❌ getEngagements error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

module.exports = {
  // auth
  adminLogin,
  adminMe,
  // stats
  getStats,
  getUserGrowth,
  getMentorIndustryStats,   // ← new
  // users
  getUsers,
  getUserDetail,
  deleteUser,
  // engagements
  getEngagementStats,
  getEngagements,
};