// controllers/changePassword.controller.js
const changePasswordService = require("../services/changePassword.service");

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const data = await changePasswordService.changePassword(
      req.user._id,
      currentPassword,
      newPassword
    );
    return res.json(data);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
};

module.exports = { changePassword };