// Dry-run by default. Use --apply only after reviewing the reported records.
require("dotenv").config();
const mongoose = require("mongoose");
const ConnectRequest = require("@leapmentor/shared/models/ConnectRequest");
const Transaction = require("@leapmentor/shared/models/Transaction");
const Escrow = require("@leapmentor/shared/models/Escrow");

const isApply = process.argv.includes("--apply");
const round = (value) => Math.round(Number(value || 0) * 100) / 100;
const sumAmount = (rows) => round(rows.reduce((sum, row) => sum + Number(row.amount || 0), 0));
const split = (amount, count) => {
  const part = round(amount / count);
  const values = Array(count).fill(part);
  if (count > 1) values[count - 1] = round(amount - values.slice(0, -1).reduce((sum, value) => sum + value, 0));
  return values;
};

const buildEscrowRecord = (request, ledger) => {
  const fallbackTime = request.paidAt || request.createdAt || request.requestedAt || request.updatedAt || new Date(0);
  const refundLedger = ledger.filter((entry) => entry.type === "escrow_refund");
  const baseCount = Number(request.sessionCount);
  const baseTotal = round(request.totalAmount);
  const baseCommission = round(request.commissionAmount);
  const basePayout = round(request.mentorPayout ?? baseTotal - baseCommission);
  const additionalSlots = (request.additionalSlots || []).filter((slot) => slot.paymentStatus === "paid");
  const totalAmount = round(baseTotal + additionalSlots.reduce((sum, slot) => sum + Number(slot.totalAmount || 0), 0));
  const commissionAmount = round(baseCommission + additionalSlots.reduce((sum, slot) => sum + Number(slot.totalAmount || 0) - Number(slot.sessionRate || 0), 0));
  const mentorPayout = round(basePayout + additionalSlots.reduce((sum, slot) => sum + Number(slot.sessionRate || 0), 0));
  const sessionCount = baseCount + additionalSlots.length;
  const refunds = refundLedger.flatMap((entry) => {
    const match = entry.description?.match(/Slot #(\d+) cancelled/i);
    if (!match) return [];
    const slotIndex = Number(match[1]) - 1;
    const key = entry.idempotencyKey || `${request._id}:${slotIndex}:refund`;
    return [{
      slotIndex,
      amount: round(entry.amount),
      key,
      cancelledBy: "migration",
      result: { requestId: String(request._id), slotIndex, refundedAmount: round(entry.amount), migrated: true },
      completedAt: entry.createdAt || fallbackTime,
    }];
  });
  const status = request.paymentStatus === "refunded"
    ? "refunded"
    : request.status === "completed"
      ? "released"
      : refunds.length > 0 ? "partially_refunded" : "held";
  const slotTotals = split(baseTotal, baseCount);
  const slotCommissions = split(baseCommission, baseCount);
  const slotPayouts = split(basePayout, baseCount);
  const slots = Array.from({ length: baseCount }, (_, slotIndex) => ({
    slotIndex,
    slotId: request.selectedSlots?.[slotIndex]?._id || null,
    totalAmount: slotTotals[slotIndex],
    commissionAmount: slotCommissions[slotIndex],
    mentorPayout: slotPayouts[slotIndex],
    status: "held",
  }));
  additionalSlots.forEach((slot, index) => slots.push({
    slotIndex: baseCount + index,
    slotId: slot._id || null,
    totalAmount: round(slot.totalAmount),
    commissionAmount: round(Number(slot.totalAmount) - Number(slot.sessionRate)),
    mentorPayout: round(slot.sessionRate),
    status: "held",
  }));
  for (const refund of refunds) {
    const slot = slots.find((item) => item.slotIndex === refund.slotIndex);
    if (slot) slot.status = "refunded";
  }
  if (status === "refunded") slots.forEach((slot) => { slot.status = "refunded"; });
  if (status === "released") slots.forEach((slot) => { if (slot.status === "held") slot.status = "released"; });
  const holdResult = {
    requestId: String(request._id), totalAmount,
    commissionRate: round(request.commissionRate), commissionAmount, mentorPayout,
    migrated: true, paymentStatus: "paid",
  };
  const operations = [{ key: `${request._id}:hold`, kind: "hold", result: holdResult, completedAt: fallbackTime }];
  if (status === "released") operations.push({
    key: `${request._id}:release`, kind: "release",
    result: {
      requestId: String(request._id),
      totalAmount: sumAmount(ledger.filter((entry) => entry.type === "escrow_release")),
      commissionRate: round(request.commissionRate),
      commissionAmount: sumAmount(ledger.filter((entry) => entry.type === "commission_deduct")),
      mentorPayout: sumAmount(ledger.filter((entry) => entry.type === "mentor_payout")),
      status: "completed", migrated: true,
    },
    completedAt: request.completedAt || request.updatedAt || fallbackTime,
  });
  if (status === "refunded") operations.push({
    key: `${request._id}:refund`, kind: "refund",
    result: { requestId: String(request._id), totalAmount: sumAmount(refundLedger), paymentStatus: "refunded", migrated: true },
    completedAt: request.updatedAt || fallbackTime,
  });
  return {
    requestId: request._id,
    mentee: request.mentee,
    mentor: request.mentor,
    sessionRate: round(request.sessionRate),
    sessionCount,
    totalAmount,
    commissionRate: round(request.commissionRate),
    commissionAmount,
    mentorPayout,
    status,
    heldAt: fallbackTime,
    releasedAt: status === "released" ? (request.completedAt || request.updatedAt || fallbackTime) : null,
    operations,
    refunds,
    slots,
  };
};

const reconcileLedger = (request, ledger) => {
  const heldAmount = sumAmount(ledger.filter((entry) => entry.type === "escrow_hold"));
  const refundedAmount = sumAmount(ledger.filter((entry) => entry.type === "escrow_refund"));
  const releasedAmount = sumAmount(ledger.filter((entry) => entry.type === "escrow_release"));
  const settlementAmount = round(refundedAmount + releasedAmount);
  const expectedHold = round(Number(request.totalAmount) + (request.additionalSlots || [])
    .filter((slot) => slot.paymentStatus === "paid")
    .reduce((sum, slot) => sum + Number(slot.totalAmount || 0), 0));
  const errors = [];
  const slotRefundIndexes = ledger
    .filter((entry) => entry.type === "escrow_refund")
    .map((entry) => entry.description?.match(/Slot #(\d+) cancelled/i))
    .filter(Boolean)
    .map((match) => Number(match[1]) - 1);
  if (request.paymentStatus === "paid" && ledger.some((entry) =>
    entry.type === "escrow_refund" && !/Slot #(\d+) cancelled/i.test(entry.description || ""))) {
    errors.push("a paid request has an unclassified refund ledger row");
  }
  if (new Set(slotRefundIndexes).size !== slotRefundIndexes.length) {
    errors.push("multiple refund ledger rows identify the same slot");
  }
  const slotLimit = Number(request.sessionCount || 0) + (request.additionalSlots || []).filter((slot) => slot.paymentStatus === "paid").length;
  if (slotRefundIndexes.some((index) => index < 0 || index >= slotLimit)) {
    errors.push("a slot refund ledger row references a slot outside the paid session range");
  }
  if (Math.abs(heldAmount - expectedHold) > 0.02) {
    errors.push(`ledger holds (${heldAmount}) do not reconcile with request total (${expectedHold})`);
  }
  if ((request.paymentStatus === "refunded" || request.status === "completed")
    && Math.abs(settlementAmount - heldAmount) > 0.05) {
    errors.push(`settled ledger total (${settlementAmount}) does not reconcile with holds (${heldAmount})`);
  }
  return errors;
};

const main = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  await mongoose.connect(process.env.MONGO_URI);
  await Escrow.init();
  await Transaction.collection.createIndex(
    { idempotencyKey: 1 },
    { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } }, name: "idempotencyKey_1" }
  );
  const requests = await ConnectRequest.find({
    totalAmount: { $gt: 0 },
    paymentStatus: { $in: ["paid", "refunded"] },
  }).lean();
  let inserted = 0;
  let existing = 0;
  let reconciled = 0;
  const errors = [];

  for (const request of requests) {
    if (!request.mentee || !request.mentor || !request.sessionCount || !request.sessionRate || request.commissionAmount == null) {
      errors.push(`${request._id}: missing financial snapshot fields`);
      continue;
    }
    const ledger = await Transaction.find({ connectRequest: request._id, type: { $in: ["escrow_hold", "escrow_refund", "escrow_release", "commission_deduct", "mentor_payout"] } }).lean();
    const reconciliationErrors = reconcileLedger(request, ledger);
    if (reconciliationErrors.length) {
      errors.push(...reconciliationErrors.map((message) => `${request._id}: ${message}`));
      continue;
    }
    const candidate = buildEscrowRecord(request, ledger);
    const current = await Escrow.findOne({ requestId: request._id }).lean();
    if (current) {
      const same = round(current.totalAmount) === candidate.totalAmount
        && round(current.commissionAmount) === candidate.commissionAmount
        && round(current.commissionRate) === candidate.commissionRate
        && round(current.mentorPayout) === candidate.mentorPayout
        && Number(current.sessionCount) === candidate.sessionCount
        && String(current.mentee) === String(candidate.mentee)
        && String(current.mentor) === String(candidate.mentor);
      if (!same) errors.push(`${request._id}: existing Escrow values differ from ConnectRequest`);
      else {
        existing += 1;
        const stateChanged = current.status !== candidate.status
          || JSON.stringify(current.operations || []) !== JSON.stringify(candidate.operations)
          || JSON.stringify(current.refunds || []) !== JSON.stringify(candidate.refunds)
          || JSON.stringify(current.slots || []) !== JSON.stringify(candidate.slots);
        if (stateChanged) {
          if (isApply) {
            await Escrow.updateOne({ requestId: request._id }, {
              $set: {
                status: candidate.status,
                operations: candidate.operations,
                refunds: candidate.refunds,
                slots: candidate.slots,
                releasedAt: candidate.releasedAt,
              },
            });
          }
          reconciled += 1;
        }
      }
      continue;
    }
    if (isApply) await Escrow.create(candidate);
    inserted += 1;
  }

  const summary = { mode: isApply ? "apply" : "dry-run", scanned: requests.length, insertedOrWouldInsert: inserted, alreadyPresent: existing, reconciledOrWouldReconcile: reconciled, errors };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (errors.length) process.exitCode = 1;
  if (!isApply) process.stdout.write("Dry run only. Review reconciliation, then rerun with --apply.\n");
};

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`${err.stack || err.message}\n`);
    process.exitCode = 1;
  }).finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
}

module.exports = { buildEscrowRecord, reconcileLedger };
