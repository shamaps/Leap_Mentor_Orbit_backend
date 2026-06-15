// controllers/changePassword.controller.js
const changePasswordService = require("../services/changePassword.service");
const { handleError } = require("../utils/AppError");
const logger = require("../utils/logger");
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
    return handleError(res, err, "changePassword.changePassword");
  }
};

module.exports = { changePassword };