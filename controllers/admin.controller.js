// backend/controllers/admin.controller.js
const AppError = require("../utils/AppError");
const adminService = require("../services/admin.service");
const { handleError } = require("../utils/AppError");
const { logger } = require("@sentry/node");


// ═════════════════════════════════════════════════════════════
// AUTH
// ═════════════════════════════════════════════════════════════

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required." });

    // ← UPDATED: pass res so service can set the httpOnly cookie
    // accessToken is no longer returned in the response body
    const result = await adminService.loginAdmin(res, email, password);
    logger.info("adminLogin completed successfully");
    return res.status(200).json({ success: true, ...result });
    // result now only contains { admin: {...} } — no accessToken
  } catch (err) {
    logger.error("Unhandled error in admin.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "adminLogin");
  }
};

// ── Admin Logout ──────────────────────────────────────────────
// Must clear the httpOnly cookie server-side — JS cannot do it
const adminLogout = (req, res) => {
  res.clearCookie("adminAccessToken", { path: "/" });
  logger.info("adminLogout completed successfully");
  return res.status(200).json({ message: "Logged out successfully" });
};

const adminMe = (_req, res) =>
  res.status(200).json({ admin: res.req.admin });

// ═════════════════════════════════════════════════════════════
// STATS
// ═════════════════════════════════════════════════════════════

const getStats = async (_req, res) => {
  try {
    const data = await adminService.fetchStats();
    logger.info("getStats completed successfully");
    return res.status(200).json(data);
  } catch (err) {
    logger.error("Unhandled error in admin.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "getStats");
  }
};

const getUserGrowth = async (_req, res) => {
  try {
    const data = await adminService.fetchUserGrowth();
    logger.info("getUserGrowth completed successfully");
    return res.status(200).json(data);
  } catch (err) {
    logger.error("Unhandled error in admin.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "getUserGrowth");
  }
};

const getMentorIndustryStats = async (_req, res) => {
  try {
    const data = await adminService.fetchMentorIndustryStats();
    logger.info("getMentorIndustryStats completed successfully");
    return res.status(200).json(data);
  } catch (err) {
    logger.error("Unhandled error in admin.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "getMentorIndustryStats");
  }
};

// ═════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ═════════════════════════════════════════════════════════════

const getUsers = async (req, res) => {
  try {
    const data = await adminService.fetchUsers(req.query);
    logger.info("getUsers completed successfully");
    return res.status(200).json(data);
  } catch (err) {
    logger.error("Unhandled error in admin.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "getUsers");
  }
};

const getUserDetail = async (req, res) => {
  try {
    const data = await adminService.fetchUserDetail(req.params.userId);
    logger.info("getUserDetail completed successfully");
    return res.status(200).json(data);
  } catch (err) {
    logger.error("Unhandled error in admin.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "getUserDetail");
  }
};

const deleteUser = async (req, res) => {
  try {
    await adminService.removeUser(req.params.userId);
    logger.info("deleteUser completed successfully");
    return res.status(204).send();
  } catch (err) {
    logger.error("Unhandled error in admin.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "deleteUser");
  }
};

const blockUser = async (req, res) => {
  try {
    const data = await adminService.blockUser(req.params.userId);
    logger.info("blockUser completed successfully");
    return res.status(200).json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in admin.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "blockUser");
  }
};

const unblockUser = async (req, res) => {
  try {
    const data = await adminService.unblockUser(req.params.userId);
    logger.info("unblockUser completed successfully");
    return res.status(200).json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in admin.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "unblockUser");
  }
};

// ═════════════════════════════════════════════════════════════
// ENGAGEMENTS
// ═════════════════════════════════════════════════════════════

const getEngagementStats = async (_req, res) => {
  try {
    const data = await adminService.fetchEngagementStats();
    logger.info("getEngagementStats completed successfully");
    return res.status(200).json(data);
  } catch (err) {
    logger.error("Unhandled error in admin.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "getEngagementStats");
  }
};

const getEngagements = async (req, res) => {
  try {
    const data = await adminService.fetchEngagements(req.query);
    logger.info("getEngagements completed successfully");
    return res.status(200).json(data);
  } catch (err) {
    logger.error("Unhandled error in admin.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "getEngagements");
  }
};

module.exports = {
  // auth
  adminLogin,
  adminLogout, 
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