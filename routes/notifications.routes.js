// optimal/routes/notifications.js
const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authenticate");
const {
  getNotifications,
  markAllRead,
  markOneRead,
  deleteNotification,
  clearAll,
} = require("../controllers/notification.controller");

router.get("/",                    authenticate, getNotifications);
router.patch("/mark-all-read",     authenticate, markAllRead);
router.patch("/:id/read",          authenticate, markOneRead);
router.delete("/clear-all",        authenticate, clearAll);
router.delete("/:id",              authenticate, deleteNotification);

module.exports = router;