// backend/middleware/adminAuth.js
const jwt       = require("jsonwebtoken");
const AdminUser = require("../models/AdminUser");

// ── Verifies admin JWT and attaches fresh admin to req.admin ──
const adminAuthenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ── Must be issued for admin ──────────────────────────
    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Access denied: not an admin token" });
    }

    const admin = await AdminUser.findById(decoded.id).select("-password");
    if (!admin)           return res.status(401).json({ message: "Admin not found" });
    if (!admin.isActive)  return res.status(403).json({ message: "Admin account is deactivated" });

    req.admin = admin;

    console.log(`🛡️  adminAuth — admin: ${admin.email}`);
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = { adminAuthenticate };