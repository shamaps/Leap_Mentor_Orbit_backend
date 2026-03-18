// backend/routes/note.routes.js
const express = require("express");
const router  = express.Router();

const { authenticate } = require("../middleware/authenticate");
const { upload }       = require("../middleware/upload.middleware");
const {
  uploadNote,
  getNotes,
  getPrivateNotes,
  deleteNote,
} = require("../controllers/note.controller");

// POST /api/notes/upload — upload a note (shared or private)
router.post(
  "/upload",
  authenticate,
  upload.single("file"),
  uploadNote
);

// ✅ /private MUST come before /:connectRequestId
// GET /api/notes/:connectRequestId/private — own private notes
router.get(
  "/:connectRequestId/private",
  authenticate,
  getPrivateNotes
);

// GET /api/notes/:connectRequestId — shared notes
router.get(
  "/:connectRequestId",
  authenticate,
  getNotes
);

// DELETE /api/notes/:id
router.delete(
  "/:id",
  authenticate,
  deleteNote
);

module.exports = router;