// middleware/authenticate.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Sentry = require("@sentry/node");
const logger = require("../utils/logger");
const { maskEmail } = require("../utils/mask");

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      logger.warn("Request with no token", {
        route: req.path,
        method: req.method,
      });
      return res.status(401).json({ message: "No token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      logger.warn("Token valid but user not found", {
        userId: decoded.id,
        route: req.path,
      });
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;

    // ✅ Masked email — ne***@yopmail.com instead of full email
    Sentry.setUser({
      id: user._id.toString(),
      email: maskEmail(user.email),
      role: user.role,
    });

    logger.info("Authenticated request", {
      userId: user._id.toString(),
      role: user.role,
      email: maskEmail(user.email), // ✅ masked
      route: req.path,
      method: req.method,
    });

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      logger.warn("Expired token used", {
        route: req.path,
        method: req.method,
      });
      return res.status(401).json({ message: "Token expired" });
    }

    logger.warn("Invalid token attempt", {
      route: req.path,
      method: req.method,
      error: err.message,
    });
    return res.status(401).json({ message: "Invalid token" });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    const userRoles = req.user?.roles || [];
    const hasRole = roles.some((role) => userRoles.includes(role));
    if (!hasRole) {
      logger.warn("Insufficient role access attempt", {
        userId: req.user?._id?.toString(),
        email: maskEmail(req.user?.email || ""),  // ✅ masked
        userRoles,
        requiredRoles: roles,
        route: req.path,
        method: req.method,
      });
      return res.status(403).json({ message: "Access denied: insufficient role" });
    }
    next();
  };
};

module.exports = { authenticate, requireRole };