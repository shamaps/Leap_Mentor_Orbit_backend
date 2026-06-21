const { handleError } = require("../utils/appError");
const { issueTokens } = require("../utils/auth.utils");
const { ok} = require("../utils/response");
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
    return handleError(res, err, "login.login");
  }
};

  return { login };
};
module.exports = createLoginController;