const { handleError } = require("../utils/appError");
const { ok } = require("../utils/response");

const createVerificationController = (verificationService, { logger }) => {
const sendVerification = async (req, res) => {
  try {
    const {  body } = await verificationService.sendVerification({ email: req.body.email });
    return ok(res, body);
  } catch (err) {
    return handleError(res, err, "verification.sendVerification");
  }
};

const resendVerification = async (req, res) => {
  try {
    const {  body } = await verificationService.resendVerification({ email: req.body.email });
    return ok(res, body);
  } catch (err) {
    return handleError(res, err, "verification.resendVerification");
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const {  body } = await verificationService.verifyOtp({ email, otp });
    return ok(res, body);
  } catch (err) {
    return handleError(res, err, "verification.verifyOtp");
  }
};

const verifyLink = async (req, res) => {
  try {
    const { token } = req.params;
    const { email } = req.query;
    const {  body } = await verificationService.verifyLink({ token, email });
    return ok(res, body);
  } catch (err) {
    return handleError(res, err, "verification.verifyLink");
  }
};
  return { sendVerification, resendVerification, verifyOtp, verifyLink };
};
module.exports = createVerificationController;