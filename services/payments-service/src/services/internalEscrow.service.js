const AppError = require("@leapmentor/shared/utils/appError");
const { withTransaction } = require("@leapmentor/shared/utils/withTransaction");
const { DEFAULT_COMMISSION_RATE } = require("@leapmentor/shared/config/constants");

const round = (value) => Math.round(value * 100) / 100;
const sameId = (a, b) => String(a) === String(b);
const allocate = (amount, count) => {
  const part = round(amount / count);
  const values = Array(count).fill(part);
  if (count > 1) values[count - 1] = round(amount - values.slice(0, -1).reduce((sum, value) => sum + value, 0));
  return values;
};
const buildSlots = (sessionCount, totalAmount, commissionAmount, mentorPayout) => {
  const totals = allocate(totalAmount, sessionCount);
  const commissions = allocate(commissionAmount, sessionCount);
  const payouts = allocate(mentorPayout, sessionCount);
  return totals.map((value, slotIndex) => ({
    slotIndex, totalAmount: value, commissionAmount: commissions[slotIndex],
    mentorPayout: payouts[slotIndex], status: "held",
  }));
};
const operationKey = (requestId, kind, slotIndex) => kind === "refund"
  ? `${requestId}:${slotIndex}:refund`
  : `${requestId}:${kind}`;

const createInternalEscrowService = (repo, { transaction = withTransaction, logger = console } = {}) => {
  const findSavedOperation = (escrow, key) => escrow?.operations?.find((item) => item.key === key);

  const execute = async (requestId, key, context, fingerprint, callback, existingSession = null) => {
    const run = async (session) => {
      const escrow = await repo.findEscrow(requestId, session);
      const saved = findSavedOperation(escrow, key);
      if (saved) {
        if (saved.fingerprint && saved.fingerprint !== fingerprint)
          throw new AppError(409, "Idempotency key was already used with different input");
        return saved.result;
      }
      return callback({ session, escrow });
    };
    if (existingSession) return run(existingSession);

    try {
      return await transaction(run, context);
    } catch (err) {
      // A concurrent call may have committed the same operation while this
      // transaction lost a write/unique-index race. Return its saved result.
      const committed = await repo.findEscrow(requestId).catch(() => null);
      const saved = findSavedOperation(committed, key);
      if (saved) {
        if (saved.fingerprint && saved.fingerprint !== fingerprint)
          throw new AppError(409, "Idempotency key was already used with different input");
        return saved.result;
      }
      throw err;
    }
  };

  const saveOperation = (escrow, key, kind, fingerprint, result) => {
    escrow.operations.push({ key, kind, fingerprint, result, completedAt: new Date() });
    return escrow;
  };

  const hold = async ({ requestId, menteeId, mentorId, sessionRate, sessionCount }, { session = null } = {}) => {
    const key = operationKey(requestId, "hold");
    const fingerprint = JSON.stringify({ menteeId: String(menteeId), mentorId: String(mentorId), sessionRate, sessionCount });
    return execute(requestId, key, "payments.internal.hold", fingerprint, async ({ session, escrow }) => {
      if (escrow) {
        const prior = findSavedOperation(escrow, key);
        if (prior) return prior.result;
        throw new AppError(409, "Escrow already exists for this request");
      }
      if (!Number.isFinite(sessionRate) || sessionRate < 1 || !Number.isInteger(sessionCount) || sessionCount < 1)
        throw new AppError(422, "sessionRate and sessionCount are invalid");

      const admin = await repo.findActiveAdmin(session);
      const commissionRate = admin?.commissionRate ?? DEFAULT_COMMISSION_RATE;
      const mentorPayout = round(sessionRate * sessionCount);
      const commissionAmount = Math.ceil((mentorPayout * commissionRate) / 100);
      const totalAmount = mentorPayout + commissionAmount;
      const wallet = await repo.findWallet(menteeId, session);
      if (!wallet) throw new AppError(404, "Mentee wallet not found");
      if (wallet.balance < totalAmount)
        throw new AppError(422, `Insufficient balance. You have ${wallet.balance} tokens but need ${totalAmount}`);

      wallet.balance = round(wallet.balance - totalAmount);
      wallet.escrow = round(wallet.escrow + totalAmount);
      await repo.saveWallet(wallet, session);

      const result = { requestId: String(requestId), totalAmount, commissionRate, commissionAmount, mentorPayout, balance: wallet.balance, escrow: wallet.escrow, paymentStatus: "paid" };
      await repo.createEscrow({
        requestId, mentee: menteeId, mentor: mentorId, sessionRate, sessionCount,
        totalAmount, commissionRate, commissionAmount, mentorPayout,
        status: "held", heldAt: new Date(), operations: [{ key, kind: "hold", fingerprint, result }], refunds: [],
        slots: buildSlots(sessionCount, totalAmount, commissionAmount, mentorPayout),
      }, session);
      await repo.insertTransactions([{
        user: menteeId, type: "escrow_hold", amount: totalAmount, connectRequest: requestId,
        description: `Escrow hold — ${sessionCount} session(s) × ${sessionRate} tokens + ${commissionRate}% platform fee`,
        balanceAfter: wallet.balance, idempotencyKey: `${key}:ledger`,
      }], session);
      logger.info?.("Escrow held", { requestId: String(requestId), totalAmount });
      return result;
    }, session);
  };

  const release = async ({ requestId, menteeId }, { session = null } = {}) => {
    const key = operationKey(requestId, "release");
    const fingerprint = JSON.stringify({ menteeId: menteeId ? String(menteeId) : null });
    const result = await execute(requestId, key, "payments.internal.release", fingerprint, async ({ session, escrow }) => {
      if (!escrow) throw new AppError(404, "Escrow not found");
      if (menteeId && !sameId(escrow.mentee, menteeId)) throw new AppError(403, "Only the mentee can confirm session completion");
      if (escrow.status === "released" || escrow.status === "refunded") throw new AppError(409, "Escrow is already settled");

      if (!escrow.slots?.length) escrow.slots = buildSlots(escrow.sessionCount, escrow.totalAmount, escrow.commissionAmount, escrow.mentorPayout);
      const activeSlots = escrow.slots.filter((slot) => slot.status === "held");
      if (!activeSlots.length) throw new AppError(409, "No refundable escrow remains to release");
      const refundedToDate = round(escrow.refunds.reduce((sum, refund) => sum + refund.amount, 0));
      const amount = round(escrow.totalAmount - refundedToDate);
      const commissionAmount = amount === escrow.totalAmount
        ? escrow.commissionAmount
        : round(escrow.commissionAmount * amount / escrow.totalAmount);
      const mentorPayout = round(amount - commissionAmount);
      const menteeWallet = await repo.findWallet(escrow.mentee, session);
      const mentorWallet = await repo.findWallet(escrow.mentor, session);
      if (!menteeWallet || !mentorWallet) throw new AppError(404, "Wallet not found");
      if (menteeWallet.escrow < amount - 1) throw new AppError(422, "Escrow balance mismatch. Contact support.");

      menteeWallet.escrow = round(menteeWallet.escrow - Math.min(amount, menteeWallet.escrow));
      mentorWallet.balance = round(mentorWallet.balance + mentorPayout);
      await Promise.all([repo.saveWallet(menteeWallet, session), repo.saveWallet(mentorWallet, session)]);
     await repo.creditPlatformWallet(commissionAmount, session);

      const result = { requestId: String(requestId), totalAmount: amount, commissionRate: escrow.commissionRate, commissionAmount, mentorPayout, menteeEscrow: menteeWallet.escrow, status: "completed" };
      escrow.status = "released";
      escrow.releasedAt = new Date();
      activeSlots.forEach((slot) => { slot.status = "released"; });
      saveOperation(escrow, key, "release", fingerprint, result);
      await repo.saveEscrow(escrow, session);
      await repo.insertTransactions([
        { user: escrow.mentee, type: "escrow_release", amount, connectRequest: requestId, description: "Escrow released on session completion", balanceAfter: menteeWallet.escrow, idempotencyKey: `${key}:escrow` },
        { user: escrow.mentor, type: "commission_deduct", amount: commissionAmount, connectRequest: requestId, description: `Platform fee (${escrow.commissionRate}%) collected`, balanceAfter: mentorWallet.balance, idempotencyKey: `${key}:commission` },
        { user: escrow.mentor, type: "mentor_payout", amount: mentorPayout, connectRequest: requestId, description: "Session payout — full rate received", balanceAfter: mentorWallet.balance, idempotencyKey: `${key}:payout` },
      ], session);
      return result;
    }, session);
    return result;
  };

  const refundSlot = async ({ requestId, slotIndex, slotId = null, cancelledBy = "system" }, { session = null } = {}) => {
    const key = operationKey(requestId, "refund", slotId || slotIndex);
    const fingerprint = JSON.stringify({ slotIndex, slotId, cancelledBy });
    const result = await execute(requestId, key, "payments.internal.refundSlot", fingerprint, async ({ session, escrow }) => {
      if (!escrow) throw new AppError(404, "Escrow not found");
      if (!escrow.slots?.length) escrow.slots = buildSlots(escrow.sessionCount, escrow.totalAmount, escrow.commissionAmount, escrow.mentorPayout);
      const slot = slotId
        ? escrow.slots.find((item) => String(item.slotId) === String(slotId))
        : escrow.slots.find((item) => item.slotIndex === slotIndex);
      if (!slot) throw new AppError(422, "Slot is not part of this escrow");
      const idx = slot.slotIndex;
      const priorRefund = escrow.refunds.find((refund) => refund.slotIndex === idx);
      if (priorRefund) return priorRefund.result;
      if (["released", "refunded"].includes(escrow.status)) throw new AppError(409, "Escrow is already settled");
      if (slot.status !== "held") throw new AppError(409, "Slot escrow is no longer held");

      const heldSlots = escrow.slots.filter((item) => item.status === "held").length;
      const refundedToDate = round(escrow.refunds.reduce((sum, refund) => sum + refund.amount, 0));
      const amount = heldSlots === 1
        ? round(escrow.totalAmount - refundedToDate)
        : Math.floor(escrow.totalAmount / escrow.sessionCount);
      if (amount < 1) throw new AppError(400, "Slot refund amount is too small to process");
      const wallet = await repo.findWallet(escrow.mentee, session);
      if (!wallet) throw new AppError(404, "Mentee wallet not found");
      if (wallet.escrow < amount) throw new AppError(422, "Escrow balance too low for slot refund. Contact support.");

      wallet.escrow = round(wallet.escrow - amount);
      wallet.balance = round(wallet.balance + amount);
      await repo.saveWallet(wallet, session);
      const result = { requestId: String(requestId), slotIndex: idx, refundedAmount: amount, balance: wallet.balance, escrow: wallet.escrow };
      escrow.refunds.push({ slotIndex: idx, amount, key, cancelledBy, result, completedAt: new Date() });
      slot.status = "refunded";
      escrow.status = escrow.refunds.length === escrow.sessionCount ? "refunded" : "partially_refunded";
      saveOperation(escrow, key, "refund", fingerprint, result);
      await repo.saveEscrow(escrow, session);
      await repo.insertTransactions([{
        user: escrow.mentee, type: "escrow_refund", amount, connectRequest: requestId,
        description: `Slot #${idx + 1} cancelled by ${cancelledBy} — partial refund of ${amount} tokens`,
        balanceAfter: wallet.balance, idempotencyKey: `${key}:ledger`,
      }], session);
      return result;
    }, session);
    if (session) return result;
    const current = await repo.findEscrow(requestId);
    return { ...result, escrowStatus: current?.status ?? null };
  };

  return { hold, release, refundSlot };
};

module.exports = { createInternalEscrowService, operationKey, buildSlots };
