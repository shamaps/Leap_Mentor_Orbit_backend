// controllers/socialAuth.controller.js
const socialAuthService = require("../services/socialAuth.service");
const { handleError } = require("../utils/AppError");
const logger = require("../utils/logger");
const socialAuth = async (req, res) => {
  try {
    const { provider, providerId, email, name, roles, termsAccepted } = req.body;
    const { status, body } = await socialAuthService.socialAuth({
      provider,
      providerId,
      email,
      name,
      roles,
      termsAccepted,
      res,
    });
    return res.status(status).json(body);
  } catch (err) {
    return handleError(res, err, "socialAuth.socialAuth");
  }
};

module.exports = { socialAuth };