// backend/routes/admin.routes.js
const express = require("express");
const router  = express.Router();

const { adminAuthenticate }  = require("../middleware/adminAuth");
const {
  adminLogin,
  adminMe,
  getStats,
  getUsers,
  getUserDetail,
  deleteUser,
} = require("../controllers/admin.controller");

// ── Auth (public) ─────────────────────────────────────────────
router.post("/auth/login", adminLogin);
router.get ("/auth/me",    adminAuthenticate, adminMe);

// ── Stats ─────────────────────────────────────────────────────
router.get("/stats", adminAuthenticate, getStats);

// ── User management ───────────────────────────────────────────
router.get   ("/users",        adminAuthenticate, getUsers);
router.get   ("/users/:userId", adminAuthenticate, getUserDetail);
router.delete("/users/:userId", adminAuthenticate, deleteUser);

module.exports = router;