const express = require("express");
const router = express.Router();
const { supportController } = require("../config/container");
const { createMessage, getMessages, resolveMessage } = supportController;
const { adminAuthenticate } = require("../middleware/adminAuth"); 
const { supportLimiter } = require("../middleware/rateLimiter");

router.post("/messages", supportLimiter, createMessage);      // public — from HelpCenter form
router.get("/messages", adminAuthenticate, getMessages);                      // admin only
router.patch("/messages/:id/resolve", adminAuthenticate, resolveMessage);     // admin only

module.exports = router;