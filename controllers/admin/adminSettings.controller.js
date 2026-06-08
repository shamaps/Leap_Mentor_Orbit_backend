// controllers/admin/adminSettings.controller.js
const adminSettingsService = require("../../services/adminSettings.service");

const { logger } = require("@sentry/node");
const handleError = (res, err) =>
  res.status(err.statusCode || 500).json({ message: err.message });

// ─────────────────────────────────────────────────────────────
// GET /api/admin/settings/overview
// ─────────────────────────────────────────────────────────────
const getOverview = async (req, res) => {
  try {
    const data = await adminSettingsService.getOverview();
    logger.info("getOverview completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in adminSettings.controller", { error: err.message, stack: err.stack });
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/admin/settings/change-password
// ─────────────────────────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    // req.admin is set by adminAuthenticate middleware
    const data = await adminSettingsService.changePassword(
      req.admin._id,
      currentPassword,
      newPassword
    );
    logger.info("changePassword completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in adminSettings.controller", { error: err.message, stack: err.stack });
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/admin/settings/add-admin
// ─────────────────────────────────────────────────────────────
const addAdmin = async (req, res) => {
  try {
    const { name, email } = req.body;
    const data = await adminSettingsService.addAdmin(name, email);
    logger.info("addAdmin completed successfully");
    return res.status(201).json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in adminSettings.controller", { error: err.message, stack: err.stack });
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/settings/commission
// ─────────────────────────────────────────────────────────────
const getCommission = async (req, res) => {
  try {
    const data = await adminSettingsService.getCommission(req.admin._id);
    logger.info("getCommission completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in adminSettings.controller", { error: err.message, stack: err.stack });
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/admin/settings/commission
// ─────────────────────────────────────────────────────────────
const updateCommission = async (req, res) => {
  try {
    const data = await adminSettingsService.updateCommission(
      req.admin._id,
      req.body.commissionRate
    );
    logger.info("updateCommission completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in adminSettings.controller", { error: err.message, stack: err.stack });
    return handleError(res, err);
  }
};

module.exports = {
  getOverview,
  changePassword,
  addAdmin,
  getCommission,
  updateCommission,
};