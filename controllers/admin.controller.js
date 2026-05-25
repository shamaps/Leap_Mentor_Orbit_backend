// backend/controllers/admin.controller.js
const AppError = require("../utils/AppError");
const adminService = require("../services/admin.service");

// ── Centralised error handler ─────────────────────────────────
const handleError = (res, err, label) => {
  if (err instanceof AppError)
    return res.status(err.status).json({ message: err.message });
  console.error(`❌ ${label} error:`, err);
  return res.status(500).json({ message: "Server error." });
};

// ═════════════════════════════════════════════════════════════
// AUTH
// ═════════════════════════════════════════════════════════════

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required." });

    const result = await adminService.loginAdmin(email, password);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return handleError(res, err, "adminLogin");
  }
};

const adminMe = (_req, res) =>
  res.status(200).json({ admin: res.req.admin });

// ═════════════════════════════════════════════════════════════
// STATS
// ═════════════════════════════════════════════════════════════

const getStats = async (_req, res) => {
  try {
    const data = await adminService.fetchStats();
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err, "getStats");
  }
};

const getUserGrowth = async (_req, res) => {
  try {
    const data = await adminService.fetchUserGrowth();
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err, "getUserGrowth");
  }
};

const getMentorIndustryStats = async (_req, res) => {
  try {
    const data = await adminService.fetchMentorIndustryStats();
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err, "getMentorIndustryStats");
  }
};

// ═════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ═════════════════════════════════════════════════════════════

const getUsers = async (req, res) => {
  try {
    const data = await adminService.fetchUsers(req.query);
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err, "getUsers");
  }
};

const getUserDetail = async (req, res) => {
  try {
    const data = await adminService.fetchUserDetail(req.params.userId);
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err, "getUserDetail");
  }
};

const deleteUser = async (req, res) => {
  try {
    const data = await adminService.removeUser(req.params.userId);
    return res.status(200).json({ success: true, ...data });
  } catch (err) {
    return handleError(res, err, "deleteUser");
  }
};

const blockUser = async (req, res) => {
  try {
    const data = await adminService.blockUser(req.params.userId);
    return res.status(200).json({ success: true, ...data });
  } catch (err) {
    return handleError(res, err, "blockUser");
  }
};

const unblockUser = async (req, res) => {
  try {
    const data = await adminService.unblockUser(req.params.userId);
    return res.status(200).json({ success: true, ...data });
  } catch (err) {
    return handleError(res, err, "unblockUser");
  }
};

// ═════════════════════════════════════════════════════════════
// ENGAGEMENTS
// ═════════════════════════════════════════════════════════════

const getEngagementStats = async (_req, res) => {
  try {
    const data = await adminService.fetchEngagementStats();
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err, "getEngagementStats");
  }
};

const getEngagements = async (req, res) => {
  try {
    const data = await adminService.fetchEngagements(req.query);
    return res.status(200).json(data);
  } catch (err) {
    return handleError(res, err, "getEngagements");
  }
};

module.exports = {
  // auth
  adminLogin,
  adminMe,
  // stats
  getStats,
  getUserGrowth,
  getMentorIndustryStats,
  // users
  getUsers,
  getUserDetail,
  deleteUser,
  blockUser,
  unblockUser,
  // engagements
  getEngagementStats,
  getEngagements,
};