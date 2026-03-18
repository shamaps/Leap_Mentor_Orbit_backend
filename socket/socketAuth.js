// backend/socket/socketAuth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ✅ JWT middleware for socket.io handshake
// Mirrors the HTTP authenticate middleware pattern
const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication error: no token provided"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return next(new Error("Authentication error: user not found"));
    }

    // ✅ Attach user to socket — available throughout socket lifecycle
    socket.user = user;
    next();
  } catch (err) {
    return next(new Error("Authentication error: invalid or expired token"));
  }
};

module.exports = socketAuth;