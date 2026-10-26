// services/catalog-service/src/routes/admin/index.js
const express = require("express");
const router = express.Router();

router.use("/mentor-verifications", require("../adminVerification.routes"));

module.exports = router;
