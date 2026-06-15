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
router.patch( "/change-password", changePassword);
router.post("/admins",       addAdmin);
router.get( "/commission",      getCommission);
router.patch( "/commission",      updateCommission);

module.exports = router;