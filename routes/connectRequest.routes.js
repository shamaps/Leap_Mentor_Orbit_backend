// routes/connectRequest.routes.js
const express = require("express");
const router = express.Router();
const { connectRequestController, mentorReferController } = require("../config/container");

const {
  sendConnectRequest, getMyRequests, getIncomingRequests,
  respondToRequest, cancelRequest, referRequest,
  getOngoingConnects, getConnectDetail,
} = connectRequestController;
const { getSimilarMentors } = mentorReferController;

const { authenticate, requireRole } = require("../middleware/authenticate");

// ✅ Mentee routes
router.post("/",           authenticate, sendConnectRequest);
router.get("/my-requests", authenticate, getMyRequests);
router.delete("/:id",      authenticate, cancelRequest);

// ✅ Mentor routes
router.get("/incoming",    authenticate, getIncomingRequests);

// ✅ SPECIFIC routes BEFORE generic /:id  <-- THIS WAS THE BUG
router.get("/:id/similar-mentors", authenticate, requireRole("mentor"), getSimilarMentors);
router.patch("/:id/refer",         authenticate, requireRole("mentor"), referRequest);
router.get("/:id/detail",          authenticate, getConnectDetail); // ✅ add this

router.get("/ongoing", authenticate, getOngoingConnects);

// ✅ Generic /:id LAST
router.patch("/:id",       authenticate, respondToRequest);

module.exports = router;