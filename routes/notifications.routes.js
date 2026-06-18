// optimal/routes/notifications.js
const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authenticate");
const { notificationController } = require("../config/container");
const {
  getNotifications, markAllRead, markOneRead, deleteNotification, clearAll,
} = notificationController;

router.get("/",                    authenticate, getNotifications);
router.patch("/mark-all-read",     authenticate, markAllRead);
router.patch("/:id/read",          authenticate, markOneRead);
router.delete("/clear-all",        authenticate, clearAll);
router.delete("/:id",              authenticate, deleteNotification);

module.exports = router;