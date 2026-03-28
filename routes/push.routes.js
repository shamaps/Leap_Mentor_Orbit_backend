const express = require("express");
const router  = express.Router();
const { authenticate } = require("../middleware/authenticate"); // ✅ fixed
const { subscribe, unsubscribe, getVapidPublicKey } = require("../controllers/pushSubscription.controller");

router.get("/vapid-public-key", getVapidPublicKey);
router.post("/subscribe",       authenticate, subscribe);
router.delete("/unsubscribe",   authenticate, unsubscribe);

module.exports = router;