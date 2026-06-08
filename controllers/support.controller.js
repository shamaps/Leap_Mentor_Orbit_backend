const supportService = require("../services/support.service");

const { logger } = require("@sentry/node");
exports.createMessage = async (req, res) => {
  try {
    const { email, subject, message, role } = req.body;
    const { status, body } = await supportService.createMessage({ email, subject, message, role });
    return res.status(status).json(body);
  } catch (err) {
    logger.error("Unhandled error in support.controller", { error: err.message, stack: err.stack });
    return res.status(500).json({ error: "Server error" });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { status, body } = await supportService.getMessages();
    return res.status(status).json(body);
  } catch (err) {
    logger.error("Unhandled error in support.controller", { error: err.message, stack: err.stack });
    return res.status(500).json({ error: "Server error" });
  }
};

exports.resolveMessage = async (req, res) => {
  try {
    const { status, body } = await supportService.resolveMessage(req.params.id);
    return res.status(status).json(body);
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ error: "Server error" });
  }
};