// backend/routes/upload.routes.js
const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authenticate");
const { upload, uploadImage } = require("../middleware/upload.middleware");
const { uploadProfilePicture, uploadVerificationDocuments } = require("../controllers/upload.controller");
const { uploadLimiter } = require("../middleware/rateLimiter");

// POST /api/upload/profile-picture
router.post(
  "/profile-picture",
  authenticate,
  uploadImage.single("profilePicture"),
  uploadLimiter,
  uploadProfilePicture
);

// POST /api/upload/verification-documents
router.post(
  "/verification-documents",
  authenticate,
  upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "workExperienceDocs", maxCount: 3 },
  ]),
  uploadLimiter,
  uploadVerificationDocuments
);

module.exports = router;