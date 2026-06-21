// src/routes/user.routes.js
const express = require("express");
const { authenticate } = require("../middleware/authenticate");
const { userController } = require("../config/container");
const router = express.Router();

const { getMe } = userController;

// GET /api/users/me — returns logged-in user's own data
router.get("/me", authenticate, getMe);

module.exports = router;