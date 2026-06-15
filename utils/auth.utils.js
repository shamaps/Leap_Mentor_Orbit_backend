// utils/auth.utils.js
const jwt = require("jsonwebtoken");
const crypto = require("node:crypto");
const { OAuth2Client } = require("google-auth-library");
const { createClerkClient } = require("@clerk/backend");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const makeOtp = () => String(crypto.randomInt(100000, 1000000));
// ── helpers ──────────────────────────────────────────────────
const getRefreshMs = () => {
  const days = Number.parseInt(process.env.JWT_REFRESH_EXPIRES_IN_DAYS || "7", 10);
  return days * 24 * 60 * 60 * 1000;
};

const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  });
};

/**
 * Merge incoming roles into an existing user's roles.
 * Saves only if the role set actually changed.
 * Extracted here because googleAuth and clerkSSO both had identical copies.
 *
 * @param {Document} user
 * @param {Array}    roles      - incoming roles from request
 * @param {Function} saveUser   - repo.saveUser for the calling context
 */
const mergeRoles = async (user, roles, saveUser) => {
    if (!Array.isArray(roles) || !roles.length) return;
    const mergedRoles = [...new Set([...user.roles, ...roles])];
    if (mergedRoles.length !== user.roles.length) {
        user.roles = mergedRoles;
        await saveUser(user);
    }
};

const signAccessToken = signToken;

const generateRefreshToken = () => crypto.randomBytes(40).toString("hex");

const setRefreshCookie = (res, refreshToken) => {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: getRefreshMs(),
    path: "/",
  });
};

const issueTokens = async (res, userId) => {
  const RefreshToken = require("../models/RefreshToken");

  const accessToken = signToken(userId);
  const rawRefresh = generateRefreshToken();
  const hashedRefresh = crypto.createHash("sha256").update(rawRefresh).digest("hex");

  await RefreshToken.create({
    user: userId,
    tokenHash: hashedRefresh,
    expiresAt: new Date(Date.now() + getRefreshMs()),
  });

  setRefreshCookie(res, rawRefresh);
  return accessToken;
};

const sanitizeUser = (user) => {
  const obj = user.toObject ? user.toObject() : user;
  delete obj.password;
  return obj;
};

const validateRoles = (roles) => {
  const validRoles = new Set(["mentor", "mentee"]);
  const uniqueRoles = [...new Set(roles)];
  for (const r of uniqueRoles) {
    if (!validRoles.has(r)) {
      return { valid: false, message: "Invalid role. Use mentor and/or mentee." };
    }
  }
  return { valid: true, uniqueRoles };
};

module.exports = {
  googleClient,
  clerkClient,
  signToken,
  signAccessToken,
  generateRefreshToken,
  setRefreshCookie,
  issueTokens,
  sanitizeUser,
  validateRoles,
  getRefreshMs,     
  mergeRoles, 
  makeOtp,    
};