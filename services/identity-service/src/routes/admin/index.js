// services/identity/src/routes/admin/index.js
const express = require("express");

const router = express.Router();

router.use("/settings", require("../adminSettings.routes"));
router.use("/", require("../admin.routes"));

module.exports = router;
