// backend/routes/upload.routes.js
const express    = require("express");
const router     = express.Router();
const multer     = require("multer");
const { authenticate }          = require("../middleware/authenticate");
const { uploadProfilePicture }  = require("../controllers/upload.controller");

// ✅ Separate multer instance — images only, 5MB limit
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
  uploadProfilePicture
);

module.exports = router;