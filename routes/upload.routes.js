// backend/routes/upload.routes.js
const express    = require("express");
const router     = express.Router();
const multer     = require("multer");
const { authenticate }          = require("../middleware/authenticate");
const { upload } = require("../middleware/upload.middleware");
const { uploadProfilePicture,uploadVerificationDocuments }  = require("../controllers/upload.controller");
const { uploadLimiter } = require("../middleware/rateLimiter");
//  Separate multer instance — images only, 5MB limit
const uploadImage = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

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
    { name: "resume",             maxCount: 1 },
    { name: "workExperienceDocs", maxCount: 3 },
  ]),
  uploadLimiter,
  uploadVerificationDocuments
);

module.exports = router;