// backend/controllers/admin/adminSettings.controller.js
const AdminUser      = require("../../models/AdminUser");
const User           = require("../../models/User");
const ConnectRequest = require("../../models/ConnectRequest");

// ─────────────────────────────────────────────────────────────
// GET /api/admin/settings/overview
// ─────────────────────────────────────────────────────────────
const getOverview = async (req, res) => {
  try {
    const [totalUsers, activeSessions] = await Promise.all([
      User.countDocuments(),
      ConnectRequest.countDocuments({ status: "ongoing" }),
    ]);
    return res.json({ success: true, totalUsers, activeSessions });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/admin/settings/change-password
// ─────────────────────────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters." });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "New password must be different." });
    }

    // req.admin is set by adminAuthenticate middleware
    const admin = await AdminUser.findById(req.admin._id);
    if (!admin) return res.status(404).json({ message: "Admin not found." });

    // comparePassword method is on AdminUser model
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect." });
    }

    // pre-save hook on AdminUser hashes password automatically
    admin.password = newPassword;
    await admin.save();

    return res.json({ success: true, message: "Password changed successfully." });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/admin/settings/add-admin
// ─────────────────────────────────────────────────────────────
const addAdmin = async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ message: "Name and email are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await AdminUser.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: "An admin with this email already exists." });
    }

    // pre-save hook on AdminUser will hash this automatically
    const tempPassword = Math.random().toString(36).slice(-8) + "A1!";

    const newAdmin = await AdminUser.create({
      name:         name.trim(),
      email:        normalizedEmail,
      password:     tempPassword,
      isSuperAdmin: false,
      isActive:     true,
    });

    return res.status(201).json({
      success:      true,
      message:      `Admin account created for ${email}.`,
      tempPassword,
      admin: {
        _id:   newAdmin._id,
        name:  newAdmin.name,
        email: newAdmin.email,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/settings/commission
// ─────────────────────────────────────────────────────────────
const getCommission = async (req, res) => {
  try {
    // commissionRate lives directly on AdminUser model
    const admin = await AdminUser.findById(req.admin._id)
      .select("commissionRate")
      .lean();

    return res.json({
      success:        true,
      commissionRate: admin?.commissionRate ?? 20,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/admin/settings/commission
// ─────────────────────────────────────────────────────────────
const updateCommission = async (req, res) => {
  try {
    const { commissionRate } = req.body;
    const rate = parseFloat(commissionRate);

    if (isNaN(rate) || rate < 0 || rate > 100) {
      return res.status(400).json({ message: "Commission rate must be between 0 and 100." });
    }

    await AdminUser.findByIdAndUpdate(req.admin._id, { commissionRate: rate });

    return res.json({
      success:        true,
      message:        `Commission rate updated to ${rate}%`,
      commissionRate: rate,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getOverview,
  changePassword,
  addAdmin,
  getCommission,
  updateCommission,
};