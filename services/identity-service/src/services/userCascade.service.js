// Identity owns User. Catalog owns profiles, engagement owns ConnectRequest and
// payments owns Wallet. When a user is deleted, soft-deleted or restored, identity
// asks those services to clean up their own data.
//
// Each call is published to a Redis Stream and carried out by userCascadeWorker,
// which retries failures, survives restarts, and dead-letters calls that keep
// failing. The owners' endpoints are idempotent, so a repeated attempt is harmless.
//
// If Redis is unreachable at publish time the call is made directly instead, so a
// Redis outage never silently skips cleanup. If that direct call fails too it is
// logged at error level with everything needed to re-run it by hand.

const { randomUUID } = require("node:crypto");

const CASCADE_STREAM = "stream:user-cascade";
const CASCADE_GROUP = "user-cascade-workers";

const ACTIONS = {
    "catalog.hardDelete": ({ catalog }, { userId }, key) => catalog.delete(`/internal/users/${userId}`, { idempotencyKey: key }),
    "catalog.softDelete": ({ catalog }, { userId }, key) => catalog.post(`/internal/users/${userId}/soft-delete`, { body: {}, idempotencyKey: key }),
    "catalog.restore": ({ catalog }, { userId }, key) => catalog.post(`/internal/users/${userId}/restore`, { body: {}, idempotencyKey: key }),
    "engagement.hardDelete": ({ engagement }, { userId }, key) => engagement.delete(`/internal/users/${userId}`, { idempotencyKey: key }),
    "engagement.softDelete": ({ engagement }, { userId }, key) => engagement.post(`/internal/users/${userId}/soft-delete`, { body: {}, idempotencyKey: key }),
    "payments.hardDelete": ({ payments }, { userId }, key) => payments.delete(`/internal/users/${userId}`, { idempotencyKey: key }),
    "payments.softDelete": ({ payments }, { userId }, key) => payments.post(`/internal/users/${userId}/soft-delete`, { body: {}, idempotencyKey: key }),
    "payments.restore": ({ payments }, { userId }, key) => payments.post(`/internal/users/${userId}/restore`, { body: {}, idempotencyKey: key }),
};

// Restore skips engagement on purpose: cancelled requests stay cancelled.
const PLANS = {
    hardDelete: ["catalog.hardDelete", "engagement.hardDelete", "payments.hardDelete"],
    softDelete: ["catalog.softDelete", "engagement.softDelete", "payments.softDelete"],
    restore: ["catalog.restore", "payments.restore"],
};

const createUserCascadeService = ({ publish, clients, logger, newOperationId = randomUUID }) => {
    const perform = (action, payload, key) => {
        const call = ACTIONS[action];
        if (!call) throw new Error(`Unsupported cascade action: ${action}`);
        return call(clients, payload, key);
    };

    // Publish first; fall back to a direct call only if Redis is unavailable.
    const dispatch = async (action, userId, operationId) => {
        const key = `${operationId}:${action}`;
        const payload = { userId: String(userId) };
        try {
            await publish(CASCADE_STREAM, action, payload, { key });
            return { action, status: "queued" };
        } catch (queueError) {
            logger.warn("User cascade queue unavailable; calling the service directly", { action, key, error: queueError.message });
        }
        try {
            await perform(action, payload, key);
            return { action, status: "completed" };
        } catch (error) {
            logger.error("User cascade call could not be queued or completed; manual cleanup needed", {
                action, key, userId: payload.userId, error: error.message,
            });
            return { action, status: "failed" };
        }
    };

    // One failing service never stops the others.
    const execute = async (planName, userId) => {
        const operationId = newOperationId();
        const results = await Promise.all(PLANS[planName].map((action) => dispatch(action, userId, operationId)));
        const pick = (status) => results.filter((r) => r.status === status).map((r) => r.action);
        const queued = pick("queued");
        const failed = pick("failed");
        const completed = pick("completed");
        // "pending" = not confirmed done yet: waiting in the queue, or failed outright.
        const pending = [...queued, ...failed];
        if (pending.length) {
            logger.warn("User cascade not finished yet", { plan: planName, userId: String(userId), operationId, queued, failed });
        }
        return { operationId, completed, queued, failed, pending };
    };

    // What the worker runs for each stream message. Throwing makes the worker retry it.
    const handlers = Object.fromEntries(
        Object.keys(ACTIONS).map((action) => [
            action,
            (payload, meta) => perform(action, payload, meta?.key || `${meta?.id}:${action}`),
        ])
    );

    return {
        hardDelete: (userId) => execute("hardDelete", userId),
        softDelete: (userId) => execute("softDelete", userId),
        restore: (userId) => execute("restore", userId),
        handlers,
    };
};

module.exports = createUserCascadeService;
module.exports.PLANS = PLANS;
module.exports.ACTIONS = ACTIONS;
module.exports.CASCADE_STREAM = CASCADE_STREAM;
module.exports.CASCADE_GROUP = CASCADE_GROUP;