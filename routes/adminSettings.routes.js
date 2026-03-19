// backend/routes/adminSettings.routes.js
const express = require("express");
const router  = express.Router();

// ✅ Use adminAuthenticate — NOT authenticate + requireRole
const { adminAuthenticate } = require("../middleware/adminAuth");

const {
  getOverview,
  changePassword,
  addAdmin,
  getCommission,
  updateCommission,
} = require("../controllers/admin/adminSettings.controller");

// All routes protected by adminAuthenticate
router.use(adminAuthenticate);

router.get( "/overview",        getOverview);
router.put( "/change-password", changePassword);
router.post("/add-admin",       addAdmin);
router.get( "/commission",      getCommission);
router.put( "/commission",      updateCommission);

module.exports = router;