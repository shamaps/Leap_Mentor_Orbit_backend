const { ok,} = require("../utils/response");
const { handleError } = require("../utils/appError");
const createSupportController = (supportService, { logger }) => {

 const createMessage = async (req, res) => {
  try {
    const { email, subject, message, role } = req.body;
    const {  body } = await supportService.createMessage({ email, subject, message, role });
    return ok(res, body);
  } catch (err) {
    return handleError(res, err, "support.createMessage");
  }
};

  const getMessages = async (req, res) => {
    try {
      const { body } = await supportService.getMessages({
        page: req.query.page,
        limit: req.query.limit,
      });
      logger.info("getMessages completed successfully");
      return ok(res, body);
    } catch (err) {
      return handleError(res, err, "support.getMessages");
    }
  };

const resolveMessage = async (req, res) => {
  try {
    const {  body } = await supportService.resolveMessage(req.params.id);
    return ok(res, body);
  } catch (err) {
    return handleError(res, err, "support.resolveMessage");
  }
};

  return { createMessage, getMessages, resolveMessage };
};
module.exports = createSupportController;