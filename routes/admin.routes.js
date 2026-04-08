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
  getEngagementStats,
  getEngagements,
  getUserGrowth,
  getMentorIndustryStats,
} = require("../controllers/admin.controller");

const {
  getAllRequests,
  getPendingCount,
  approveRequest,
  rejectRequest,
} = require("../controllers/leapRequest.controller");

// ── Auth (public) ─────────────────────────────────────────────
router.post("/auth/login", adminLogin);
router.get ("/auth/me",    adminAuthenticate, adminMe);

// ── Stats ─────────────────────────────────────────────────────
router.get("/stats", adminAuthenticate, getStats);

router.get("/user-growth", adminAuthenticate, getUserGrowth);
// ── User management ───────────────────────────────────────────
router.get   ("/users",        adminAuthenticate, getUsers);
router.get   ("/users/:userId", adminAuthenticate, getUserDetail);
router.delete("/users/:userId", adminAuthenticate, deleteUser);

//engagements
router.get("/engagements/stats", adminAuthenticate, getEngagementStats);
router.get("/stats/mentor-industries", adminAuthenticate, getMentorIndustryStats);
router.get("/engagements",       adminAuthenticate, getEngagements);

// ── Leap / Wallet Requests ─────────────────────────────────────
router.get  ("/leap-requests",              adminAuthenticate, getAllRequests);
router.get  ("/leap-requests/pending-count",adminAuthenticate, getPendingCount);
router.patch("/leap-requests/:id/approve",  adminAuthenticate, approveRequest);
router.patch("/leap-requests/:id/reject",   adminAuthenticate, rejectRequest);

module.exports = router;