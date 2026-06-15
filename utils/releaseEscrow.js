// backend/utils/releaseEscrow.js
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const ConnectRequest = require("../models/ConnectRequest");
const AdminUser = require("../models/AdminUser");
const logger = require("../utils/logger");

const r = (n) => Math.round(n * 100) / 100;
const releaseEscrow = async (connectRequestId, mongoSession) => {
  const connectRequest = await ConnectRequest.findById(connectRequestId)
    .session(mongoSession);

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
    Wallet.findOne({ user: menteeId }).session(mongoSession),
    Wallet.findOne({ user: mentorId }).session(mongoSession),
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

  await menteeWallet.save({ session: mongoSession });
  await mentorWallet.save({ session: mongoSession });

  // ── Mark session completed ────────────────────────────────
  connectRequest.status = "completed";
  connectRequest.completedAt = new Date();
  await connectRequest.save({ session: mongoSession });

  // ── Log 3 transactions ────────────────────────────────────
  await Transaction.create(
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
      await AdminUser.findOneAndUpdate(
        { isActive: true },
        { $inc: { walletBalance: adjustedCommission } }
      );
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