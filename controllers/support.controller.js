const { ok, fail } = require("../utils/response");
const createSupportController = (supportService, { logger }) => {

 const createMessage = async (req, res) => {
  try {
    const { email, subject, message, role } = req.body;
    const {  body } = await supportService.createMessage({ email, subject, message, role });
    return ok(res, body);
  } catch (err) {
    logger.error("Unhandled error in support.controller", { error: err.message, stack: err.stack });
    return fail(res, "Server error", 500);
  }
};

const getMessages = async (req, res) => {
  try {
    const {  body } = await supportService.getMessages();
    return ok(res, body);
  } catch (err) {
    logger.error("Unhandled error in support.controller", { error: err.message, stack: err.stack });
    return fail(res, "Server error", 500);
  }
};

const resolveMessage = async (req, res) => {
  try {
    const {  body } = await supportService.resolveMessage(req.params.id);
    return ok(res, body);
  } catch (err) {
    logger.error(err);
    return fail(res, "Server error", 500);
  }
};

  return { createMessage, getMessages, resolveMessage };
};
module.exports = createSupportController;