// controllers/register.controller.js
const registerService = require("../services/register.service");

const { logger } = require("@sentry/node");
const register = async (req, res) => {
  try {
    // res is passed through because issueTokens sets a cookie on it
    const data = await registerService.register(res, req.body);
    logger.info("register completed successfully");
    return res.status(201).json(data);
  } catch (err) {
    logger.error("Unhandled error in register.controller", { error: err.message, stack: err.stack });
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
};

module.exports = { register };