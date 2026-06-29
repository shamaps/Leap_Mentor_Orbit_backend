const { handleError } = require("../utils/appError");
const { ok, noContent } = require("../utils/response");

/**
 * @typedef {Object} PushSubscriptionService
 * @property {(params: Object) => Promise<{ status: number, body: Object }>} subscribe - Evaluates and commits active subscription vectors.
 * @property {(context: Object) => Promise<{ status: number, body: any }>} unsubscribe - Erases individual terminal endpoints from arrays.
 * @property {() => { status: number, body: { publicKey: string } }} getVapidPublicKey - Isolates environment verification public tags.
 */

/**
 * Factory assembling presentation entry controllers layer handling HTTP push notification parameters orchestration.
 * * @param {PushSubscriptionService} pushSubscriptionService - Underlying core messaging logic worker module instance.
 * @param {{ logger: Logger }} dependencies - Performance trace logger diagnostics utility parameters wrapper.
 * @returns {Object} Grouped controller routes callback actions container mapping blueprint.
 */
const createPushSubscriptionController = (pushSubscriptionService, { logger }) => {
  // POST /api/push/subscribe
  /**
   * Express Route Handler parsing session token vectors to register new push channel targets.
   * * @async
   * @function subscribe
   * @param {import('express').Request & { user: { _id: any } }} req - Input message frame context holding body elements and indices.
   * @param {import('express').Response} res - Standard outbound data response transport connector pipeline socket channel.
   */
  const subscribe = async (req, res) => {
    try {
      const { body } = await pushSubscriptionService.subscribe({
        userId: req.user._id,
        subscription: req.body.subscription,
      });
      logger.info("subscribe completed successfully");
      return ok(res, body);
    } catch (err) {
      return handleError(res, err, "pushSubscription.subscribe");
    }
  };


  // DELETE /api/push/unsubscribe
  /**
   * Express Route Handler initiating disconnection pathways over custom registered device identifiers.
   * * @async
   * @function unsubscribe
   * @param {import('express').Request & { user: { _id: any } }} req - Route context parameter request object holding path indicator parameters.
   * @param {import('express').Response} res - Structural payload interface output transport channel adaptor pipeline.
   */
  const unsubscribe = async (req, res) => {
    try {
      const { body } = await pushSubscriptionService.unsubscribe({
        userId: req.user._id,
        endpoint: req.body.endpoint,
      });
      logger.info("unsubscribe completed successfully");
      return body ? ok(res, body) : noContent(res);
    } catch (err) {
      return handleError(res, err, "pushSubscription.unsubscribe");
    }
  };

  // GET /api/push/vapid-public-key
  /**
   * Express Route Handler returning public metadata keys needed by client workers to authorize incoming triggers.
   * * @function getVapidPublicKey
   * @param {import('express').Request} req - Disregarded request transport framework wrapper.
   * @param {import('express').Response} res - Standard data output channel execution returning connector transport socket.
   */
  const getVapidPublicKey = (req, res) => {
    const { body } = pushSubscriptionService.getVapidPublicKey();
    return ok(res, body);
  };

  return { subscribe, unsubscribe, getVapidPublicKey };
};

module.exports = createPushSubscriptionController;