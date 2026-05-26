const verificationService = require("../services/verification.service");

exports.sendVerification = async (req, res) => {
  try {
    const { status, body } = await verificationService.sendVerification({ email: req.body.email });
    return res.status(status).json(body);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const { status, body } = await verificationService.resendVerification({ email: req.body.email });
    return res.status(status).json(body);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const { status, body } = await verificationService.verifyOtp({ email, otp });
    return res.status(status).json(body);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.verifyLink = async (req, res) => {
  try {
    const { token } = req.params;
    const { email } = req.query;
    const { status, body } = await verificationService.verifyLink({ token, email });
    return res.status(status).json(body);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};