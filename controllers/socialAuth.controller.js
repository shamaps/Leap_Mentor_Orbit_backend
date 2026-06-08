// controllers/socialAuth.controller.js
const socialAuthService = require("../services/socialAuth.service");

const { logger } = require("@sentry/node");
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
    logger.error("Unhandled error in socialAuth.controller", { error: err.message, stack: err.stack });
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { socialAuth };