const express = require("express");
const router  = express.Router();

const { authenticate }      = require("../middleware/authenticate");
const { adminAuthenticate } = require("../middleware/adminAuth");
const {
  getMyRequest,
  createRequest,
  getAllRequests,
  approveRequest,
  rejectRequest,
} = require("../controllers/leapRequest.controller");

// Mentee routes
router.get ("/my-request", authenticate,      getMyRequest);
router.post("/",           authenticate,      createRequest);

// Admin routes
router.get   ("/",            adminAuthenticate, getAllRequests);
router.patch ("/:id/approve", adminAuthenticate, approveRequest);
router.patch ("/:id/reject",  adminAuthenticate, rejectRequest);

module.exports = router;
