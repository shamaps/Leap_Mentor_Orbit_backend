const express = require("express");
const router = express.Router();
const { createMessage, getMessages, resolveMessage } = require("../controllers/support.controller");
const { adminAuthenticate } = require("../middleware/adminAuth"); // ✅ fixed name
const { supportLimiter } = require("../middleware/rateLimiter");

router.post("/messages", supportLimiter, createMessage);                                      // public — from HelpCenter form
router.get("/messages", adminAuthenticate, getMessages);                      // admin only
router.patch("/messages/:id/resolve", adminAuthenticate, resolveMessage);     // admin only

module.exports = router;