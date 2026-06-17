// backend/utils/releaseEscrow.js
const repo = require("../repositories/escrow.repository");
const logger = require("../utils/logger");

const r = (n) => Math.round(n * 100) / 100;
const releaseEscrow = async (connectRequestId, mongoSession) => {
  const connectRequest = await repo.findConnectRequestRaw(connectRequestId, mongoSession);

  if (!connectRequest) throw new Error("Connect request not found");
  if (connectRequest.paymentStatus !== "paid") throw new Error("No paid escrow found for this session");
  if (connectRequest.status === "completed") throw new Error("Session already completed");

  const {
    totalAmount,
    mentorPayout,
    commissionAmount,
    commissionRate,
    mentee: menteeId,
    mentor: mentorId,
    selectedSlots,
  } = connectRequest;

  // ── Calculate how much was already refunded for cancelled slots ──
  const totalSlots = selectedSlots.length;
  const cancelledSlots = selectedSlots.filter(s => s.status === "cancelled").length;
  const activeSlots = totalSlots - cancelledSlots;

  // Per-slot amounts
  const perSlotTotal = totalSlots > 0 ? r(totalAmount / totalSlots) : 0;
  const perSlotPayout = totalSlots > 0 ? r(mentorPayout / totalSlots) : 0;
  const perSlotCommission = totalSlots > 0 ? r(commissionAmount / totalSlots) : 0;

  const expectedEscrow = r(perSlotTotal * activeSlots);
  const adjustedPayout = r(perSlotPayout * activeSlots);
  const adjustedCommission = r(perSlotCommission * activeSlots);
  // ── Fetch wallets ─────────────────────────────────────────
  const [menteeWallet, mentorWallet] = await Promise.all([
    repo.findWalletByUser(menteeId, mongoSession),
    repo.findWalletByUser(mentorId, mongoSession),
  ]);

  if (!menteeWallet) throw new Error("Mentee wallet not found");
  if (!mentorWallet) throw new Error("Mentor wallet not found");

  // Allow small floating point tolerance (±1 token)
  if (menteeWallet.escrow < expectedEscrow - 1) {
    throw new Error(
      `Escrow balance mismatch. Expected ~${expectedEscrow}, found ${menteeWallet.escrow}. Contact support.`
    );
  }

  // ── Settle wallets ────────────────────────────────────────
  menteeWallet.escrow -= menteeWallet.escrow;   // drain whatever remains (handles rounding)
  mentorWallet.balance += adjustedPayout;

  await repo.saveWallet(menteeWallet, mongoSession);
  await repo.saveWallet(mentorWallet, mongoSession);

  // ── Mark session completed ────────────────────────────────
  connectRequest.status = "completed";
  connectRequest.completedAt = new Date();
  await repo.saveConnectRequest(connectRequest, mongoSession);

  // ── Log 3 transactions ────────────────────────────────────
  await repo.createTransaction(
    [
      {
        user: menteeId,
        type: "escrow_release",
        amount: expectedEscrow,
        connectRequest: connectRequest._id,
        description: `Escrow released — ${activeSlots}/${totalSlots} active slots completed`,
        balanceAfter: menteeWallet.escrow,
      },
      {
        user: mentorId,
        type: "commission_deduct",
        amount: adjustedCommission,
        connectRequest: connectRequest._id,
        description: `Platform fee (${commissionRate}%) collected`,
        balanceAfter: mentorWallet.balance,
      },
      {
        user: mentorId,
        type: "mentor_payout",
        amount: adjustedPayout,
        connectRequest: connectRequest._id,
        description: `Session payout — ${activeSlots} active slot(s)`,
        balanceAfter: mentorWallet.balance,
      },
    ],
    { session: mongoSession, ordered: true }
  );

  // ── Credit admin wallet after commit ──────────────────────
  setImmediate(async () => {
    try {
      const admin = await repo.findActiveAdmin();
      if (admin) await repo.creditAdmin(admin._id, adjustedCommission);
      logger.info("Admin wallet credited", { amount: adjustedCommission });
    } catch (err) {
      logger.error("Admin wallet credit failed", { error: err.message, stack: err.stack });
    }
  });

  logger.info("Escrow released", { activeSlots, totalSlots, expectedEscrow, adjustedCommission, commissionRate, adjustedPayout });

  return {
    totalAmount: expectedEscrow,
    commissionRate,
    commissionAmount: adjustedCommission,
    mentorPayout: adjustedPayout,
    menteeEscrow: menteeWallet.escrow,
    mentorBalance: mentorWallet.balance,
  };
};
module.exports = releaseEscrow; 