const AppError = require("../utils/appError");
const { issueTokens } = require("../utils/auth.utils");
const { ok, fail } = require("../utils/response");
const createLoginController = (loginService, { logger }) => {
const login = async (req, res) => {
  try {
    const result = await loginService.login(req.body.email, req.body.password);

    const accessToken = await issueTokens(res, result.user._id);

    //  Successful login
    logger.info("User logged in successfully", {
      userId: result.user._id,
      role: result.user.role,
      email: result.user.email,
    });

    logger.info("login completed successfully");
    return ok(res, {
      message: "Login successful",
      accessToken,
      user: result.user,
      isNewUser: false
    });
  } catch (err) {
    if (err instanceof AppError) {
      // ✅ Known errors — warn level
      logger.warn("Login rejected", {
        email: req.body.email,
        reason: err.message,
        status: err.status,
        isEmailVerified: err.isEmailVerified,
      });

      const body = { message: err.message };
      if (err.isEmailVerified !== undefined) body.isEmailVerified = err.isEmailVerified;
      if (err.email) body.email = err.email;
      return res.status(err.status).json({ success: false, ...body });
    }

    // ✅ Unexpected errors — error level
    logger.error("Unexpected error during login", {
      email: req.body.email,
      error: err.message,
    });

    return fail(res, "Internal server error", 500);
  }
};

  return { login };
};
module.exports = createLoginController;