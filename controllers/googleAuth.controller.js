// controllers/googleAuth.controller.js
const service = require("../services/googleAuth.service");
const { issueTokens } = require("../utils/auth.utils");   // ← ADD

const googleAuth = async (req, res, next) => {
  try {
    const { credential, roles, termsAccepted } = req.body;

    // Service now returns { user, isNewUser } — no token
    const { user, isNewUser } = await service.googleAuth({ credential, roles, termsAccepted });

    const accessToken = await issueTokens(res, user._id);  // ← ADD

    return res.json({
      message: "Google login successful",
      accessToken,    // ← was "token"
      user,
      isNewUser,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { googleAuth };