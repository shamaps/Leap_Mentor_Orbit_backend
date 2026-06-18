const express = require("express");
const router  = express.Router();
const { authenticate } = require("../middleware/authenticate"); // ✅ fixed
const { pushSubscriptionController } = require("../config/container");
const { subscribe, unsubscribe, getVapidPublicKey } = pushSubscriptionController;

router.get("/vapid-public-key", getVapidPublicKey);
router.post("/subscribe",       authenticate, subscribe);
router.delete("/unsubscribe",   authenticate, unsubscribe);

module.exports = router;