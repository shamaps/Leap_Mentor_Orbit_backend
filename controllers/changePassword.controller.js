// controllers/changePassword.controller.js
const changePasswordService = require("../services/changePassword.service");

const { logger } = require("@sentry/node");
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const data = await changePasswordService.changePassword(
      req.user._id,
      currentPassword,
      newPassword
    );
    logger.info("changePassword completed successfully");
    return res.json(data);
  } catch (err) {
    logger.error("Unhandled error in changePassword.controller", { error: err.message, stack: err.stack });
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
};

module.exports = { changePassword };