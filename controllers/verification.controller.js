const verificationService = require("../services/verification.service");
const { handleError } = require("../utils/appError");
const logger = require("../utils/logger");
const { ok } = require("../utils/response");
exports.sendVerification = async (req, res) => {
  try {
    const {  body } = await verificationService.sendVerification({ email: req.body.email });
    return ok(res, body);
  } catch (err) {
    return handleError(res, err, "verification.sendVerification");
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const {  body } = await verificationService.resendVerification({ email: req.body.email });
    return ok(res, body);
  } catch (err) {
    return handleError(res, err, "verification.resendVerification");
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const {  body } = await verificationService.verifyOtp({ email, otp });
    return ok(res, body);
  } catch (err) {
    return handleError(res, err, "verification.verifyOtp");
  }
};

exports.verifyLink = async (req, res) => {
  try {
    const { token } = req.params;
    const { email } = req.query;
    const {  body } = await verificationService.verifyLink({ token, email });
    return ok(res, body);
  } catch (err) {
    return handleError(res, err, "verification.verifyLink");
  }
};