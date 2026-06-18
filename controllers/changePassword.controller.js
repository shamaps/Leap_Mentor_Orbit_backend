// controllers/changePassword.controller.js
const { handleError } = require("../utils/appError");
const createChangePasswordController = (changePasswordService, { logger }) => {
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const data = await changePasswordService.changePassword(
      req.user._id,
      currentPassword,
      newPassword
    );
    logger.info("changePassword completed successfully");
    return ok(res, data);
  } catch (err) {
    return handleError(res, err, "changePassword.changePassword");
  }
};

  return { changePassword };
};
module.exports = createChangePasswordController;