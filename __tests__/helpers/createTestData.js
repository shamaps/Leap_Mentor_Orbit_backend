// backend/__tests__/helpers/createTestData.js
const jwt        = require("jsonwebtoken");
const User       = require("../../models/User");
const Wallet     = require("../../models/Wallet");
const ConnectRequest = require("../../models/ConnectRequest");
const AdminUser  = require("../../models/AdminUser");

// ── Create a test admin ───────────────────────────────────────
// Must be called at the start of every test that hits escrow endpoints
// because getAdmin() in escrow.controller.js requires an active admin
const createTestAdmin = async ({
  commissionRate = 20,
  walletBalance  = 0,
} = {}) => {
  return await AdminUser.create({
    name:           "Test Admin",
    email:          "admin@test.com",
    password:       "hashedpassword",
    isActive:       true,
    commissionRate,
    walletBalance,
  });
};

// ── Create a test user + wallet ───────────────────────────────
const createTestUser = async ({
  name    = "Test User",
  email   = "test@gmail.com",
  roles   = ["mentee"],
  balance = 500,
} = {}) => {
  const user = await User.create({
    name,
    email,
    password:        "hashedpassword",
    roles,
    isEmailVerified: true,
    termsAccepted:   true,
  });

  await Wallet.create({
    user:    user._id,
    balance,
    escrow:  0,
  });

  const token = jwt.sign(
    { id: user._id, roles },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  return { user, token };
};

// ── Create a test connect request ─────────────────────────────
const createTestConnect = async ({
  mentee,
  mentor,
  status        = "accepted",
  paymentStatus = "unpaid",
  sessionRate   = 30,
  sessionCount  = 2,
  totalAmount   = 60,
} = {}) => {
  return await ConnectRequest.create({
    mentee:        mentee._id,
    mentor:        mentor._id,
    status,
    paymentStatus,
    sessionRate,
    sessionCount,
    totalAmount,
    selectedSlots: [
      {
        day:       "Monday",
        date:      "2026-04-07",
        startTime: "10:00",
        endTime:   "11:00",
      },
      {
        day:       "Tuesday",
        date:      "2026-04-08",
        startTime: "11:00",
        endTime:   "12:00",
      },
    ],
    confirmedSlot: {
      day:       "Monday",
      date:      "2026-04-07",
      startTime: "10:00",
      endTime:   "11:00",
    },
    requestedAt: new Date(),
    respondedAt: new Date(),
  });
};

module.exports = { createTestUser, createTestConnect, createTestAdmin };