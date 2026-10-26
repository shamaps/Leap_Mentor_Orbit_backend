// middleware/authenticate.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Sentry = require("@sentry/node");
const logger = require("../utils/logger");
const { idToString } = require("../utils/idToString");
const { maskEmail } = require("../utils/mask");
const config = require("../config/env");
const { hasPermission } = require("../config/permissions");
const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];

    if (!token) {
      logger.warn("Request with no token", {
        route: req.path,
        method: req.method,
      });
      return res.status(401).json({ message: "No token" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      logger.warn("Token valid but user not found", {
        userId: decoded.id,
        route: req.path,
      });
      return res.status(401).json({ message: "User not found" });
    }

    if (user.isDeleted) {
      logger.warn("Blocked or deleted user attempted to authenticate", {
        userId: idToString(user._id),
        route: req.path,
        method: req.method,
      });
      return res.status(401).json({ message: "User account is unavailable" });
    }

    req.user = user;

    //  Masked email — ne***@yopmail.com instead of full email
    Sentry.setUser({
      id: idToString(user._id),
      email: maskEmail(user.email),
      role: user.roles?.[0],
    });

    logger.info("Authenticated request", {
      userId: idToString(user._id),
      role: user.roles?.[0],
      email: maskEmail(user.email),
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

    // Bad or malformed token (including an invalid id inside it) is the client's problem: 401.
    if (
      err.name === "JsonWebTokenError" ||
      err.name === "NotBeforeError" ||
      err.name === "CastError"
    ) {
      logger.warn("Invalid token attempt", {
        route: req.path,
        method: req.method,
        error: err.message,
      });
      return res.status(401).json({ message: "Invalid token" });
    }

    // Anything else (database down, timeout, bug) is OUR problem: 503, not "bad credentials".
    Sentry.captureException(err);
    logger.error("Authentication failed due to server error", {
      route: req.path,
      method: req.method,
      error: err.message,
      stack: err.stack,
    });
    return res.status(503).json({ message: "Authentication service unavailable" });
  }
};


const requirePermission = (...permissions) => {
  return (req, res, next) => {
    const userRoles = req.user?.roles || [];
    const granted = permissions.some((permission) => hasPermission(userRoles, permission));
    if (!granted) {
      logger.warn("Insufficient permission access attempt", {
        userId: idToString(req.user?._id),
        email: maskEmail(req.user?.email || ""),
        userRoles,
        requiredPermissions: permissions,
        route: req.path,
        method: req.method,
      });
      return res.status(403).json({ message: "Access denied: insufficient permission" });
    }
    next();
  };
};

module.exports = { authenticate, requirePermission };