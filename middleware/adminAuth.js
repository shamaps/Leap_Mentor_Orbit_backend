// backend/middleware/adminAuth.js
const jwt = require("jsonwebtoken");
const AdminUser = require("../models/AdminUser");
const logger = require("../utils/logger");
const config = require("../config/env");

// ── UPDATED: reads adminAccessToken from httpOnly cookie ──────
// Previously read from req.headers.authorization (Bearer token)
// Now reads from req.cookies.adminAccessToken — JS cannot read this
const adminAuthenticate = async (req, res, next) => {
  try {
    // ← CHANGED: was req.headers.authorization?.split(" ")[1]
    const token = req.cookies?.adminAccessToken;

    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, config.jwtSecret);

    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Access denied: not an admin token" });
    }

    const admin = await AdminUser.findById(decoded.id).select("-password");
    if (!admin) return res.status(401).json({ message: "Admin not found" });
    if (!admin.isActive) return res.status(403).json({ message: "Admin account is deactivated" });

    req.admin = admin;

    logger.info("Admin authenticated", { adminId: admin._id, email: admin.email });
    next();
  } catch (err) {
    logger.error("Admin authentication failed", { error: err.message, stack: err.stack });
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = { adminAuthenticate };