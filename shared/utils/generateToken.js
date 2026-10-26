// utils/generateToken.js
const jwt = require("jsonwebtoken");
const crypto = require("node:crypto");
const config = require("../config/env");

// Short-lived — sent in response body / memory only
const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, config.jwtSecret, {
  expiresIn: config.jwtAccessExpiresIn,
  });
};

// Long-lived — stored in DB, sent as HttpOnly cookie only
const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString("hex");
};

module.exports = { generateAccessToken, generateRefreshToken };