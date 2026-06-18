// backend/routes/adminSettings.routes.js
const express = require("express");
const router  = express.Router();

// ✅ Use adminAuthenticate — NOT authenticate + requireRole
const { adminAuthenticate } = require("../middleware/adminAuth");

const { adminSettingsController } = require("../config/container");
const {
  getOverview, changePassword, addAdmin, getCommission, updateCommission,
} = adminSettingsController;

// All routes protected by adminAuthenticate
router.use(adminAuthenticate);

router.get( "/overview",        getOverview);
router.patch( "/change-password", changePassword);
router.post("/admins",       addAdmin);
router.get( "/commission",      getCommission);
router.patch( "/commission",      updateCommission);

module.exports = router;