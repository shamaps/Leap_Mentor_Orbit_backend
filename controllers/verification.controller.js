const { handleError } = require("../utils/appError");
const { ok, fail } = require("../utils/response");

const createVerificationController = (verificationService, { logger }) => {
  const sendVerification = async (req, res) => {
    try {
      const { status, body } = await verificationService.sendVerification({ email: req.body.email });
      return status === 200 ? ok(res, body) : fail(res, body.message, status);
    } catch (err) {
      return handleError(res, err, "verification.sendVerification");
    }
  };

  const resendVerification = async (req, res) => {
    try {
      const { status, body } = await verificationService.resendVerification({ email: req.body.email });
      return status === 200 ? ok(res, body) : fail(res, body.message, status);
    } catch (err) {
      return handleError(res, err, "verification.resendVerification");
    }
  };

  const verifyOtp = async (req, res) => {
    try {
      const { email, otp } = req.body;
      const { status, body } = await verificationService.verifyOtp({ email, otp });
      return status === 200 ? ok(res, body) : fail(res, body.message, status);
    } catch (err) {
      return handleError(res, err, "verification.verifyOtp");
    }
  };

  const verifyLink = async (req, res) => {
    try {
      const { token } = req.params;
      const { email } = req.query;
      const { status, body } = await verificationService.verifyLink({ token, email });
      return status === 200 ? ok(res, body) : fail(res, body.message, status);
    } catch (err) {
      return handleError(res, err, "verification.verifyLink");
    }
  };
  return { sendVerification, resendVerification, verifyOtp, verifyLink };
};
module.exports = createVerificationController;