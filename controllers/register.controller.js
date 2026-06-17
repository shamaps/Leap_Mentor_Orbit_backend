// controllers/register.controller.js
const registerService = require("../services/register.service");
const { handleError } = require("../utils/appError");
const logger = require("../utils/logger");
const { created } = require("../utils/response");
const register = async (req, res) => {
  try {
    // res is passed through because issueTokens sets a cookie on it
    const data = await registerService.register(res, req.body);
    logger.info("register completed successfully");
    return created(res, data);
  } catch (err) {
    return handleError(res, err, "register.register");
  }
};

module.exports = { register };