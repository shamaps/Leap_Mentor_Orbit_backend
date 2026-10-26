const ServiceCompensation = require("../models/ServiceCompensation");

const enqueue = (key, action, payload) => ServiceCompensation.findOneAndUpdate(
    { key },
    { $setOnInsert: { key, action, payload, status: "pending", nextAttemptAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
);

const complete = (id, result) => ServiceCompensation.updateOne(
    { _id: id },
    { $set: { status: "completed", result, completedAt: new Date(), leaseUntil: null, lastError: "" } }
);

const scheduleRetry = (record, error) => {
    const delayMs = Math.min(15 * 60_000, 1000 * (2 ** Math.min(record.attempts, 10)));
    return ServiceCompensation.updateOne(
        { _id: record._id },
        { $set: {
            // These records represent owed business operations. Keep retrying
            // even for persistent downstream/configuration errors; operators
            // can repair the cause and the next attempt will recover the work.
            status: "pending",
            nextAttemptAt: new Date(Date.now() + delayMs), leaseUntil: null,
            lastError: String(error?.message || error).slice(0, 2000),
        } }
    );
};

const claimNext = (now = new Date()) => ServiceCompensation.findOneAndUpdate(
    { $or: [
        { status: "pending", nextAttemptAt: { $lte: now } },
        { status: "processing", leaseUntil: { $lte: now } },
    ] },
    { $set: { status: "processing", leaseUntil: new Date(now.getTime() + 60_000) }, $inc: { attempts: 1 } },
    { new: true, sort: { createdAt: 1 } }
);

module.exports = { enqueue, complete, scheduleRetry, claimNext };
