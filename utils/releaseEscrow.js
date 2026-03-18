// backend/utils/releaseEscrow.js
const Wallet         = require("../models/Wallet");
const Transaction    = require("../models/Transaction");
const ConnectRequest = require("../models/ConnectRequest");
const AdminUser      = require("../models/AdminUser");

/**
 * Releases escrowed tokens with commission split:
 *   - Mentor receives: mentorPayout (full rate, stored at pay time)
 *   - Platform receives: commissionAmount (fee markup, stored at pay time)
 *
 * Called automatically when ALL session slots are marked complete by both parties.
 *
 * @param {string}           connectRequestId
 * @param {mongoose.Session} mongoSession — pass existing transaction session
 */
const releaseEscrow = async (connectRequestId, mongoSession) => {
  const connectRequest = await ConnectRequest.findById(connectRequestId)
    .session(mongoSession);

  if (!connectRequest) throw new Error("Connect request not found");
  if (connectRequest.paymentStatus !== "paid") throw new Error("No paid escrow found for this session");
  if (connectRequest.status === "completed")   throw new Error("Session already completed");

  const {
    totalAmount,
    mentorPayout,     // stored at pay time = sessionRate × sessionCount
    commissionAmount, // stored at pay time = platform markup fee
    commissionRate,   // stored at pay time = admin rate snapshot
    mentee: menteeId,
    mentor: mentorId,
  } = connectRequest;

  // ── Fetch wallets ─────────────────────────────────────────
  const [menteeWallet, mentorWallet] = await Promise.all([
    Wallet.findOne({ user: menteeId }).session(mongoSession),
    Wallet.findOne({ user: mentorId }).session(mongoSession),
  ]);

  if (!menteeWallet) throw new Error("Mentee wallet not found");
  if (!mentorWallet) throw new Error("Mentor wallet not found");
  if (menteeWallet.escrow < totalAmount) throw new Error("Escrow balance mismatch. Contact support.");

  // ── Settle wallets ────────────────────────────────────────
  menteeWallet.escrow  -= totalAmount;    // release full escrow
  mentorWallet.balance += mentorPayout;   // mentor gets full rate

  await menteeWallet.save({ session: mongoSession });
  await mentorWallet.save({ session: mongoSession });

  // ── Mark session completed ────────────────────────────────
  connectRequest.status      = "completed";
  connectRequest.completedAt = new Date();
  await connectRequest.save({ session: mongoSession });

  // ── Log 3 transactions ────────────────────────────────────
  await Transaction.create(
    [
      // 1. Mentee escrow release
      {
        user:           menteeId,
        type:           "escrow_release",
        amount:         totalAmount,
        connectRequest: connectRequest._id,
        description:    "Escrow released — all sessions completed by both parties",
        balanceAfter:   menteeWallet.escrow,
      },
      // 2. Platform commission
      {
        user:           mentorId,
        type:           "commission_deduct",
        amount:         commissionAmount,
        connectRequest: connectRequest._id,
        description:    `Platform fee (${commissionRate}%) collected`,
        balanceAfter:   mentorWallet.balance,
      },
      // 3. Mentor net payout
      {
        user:           mentorId,
        type:           "mentor_payout",
        amount:         mentorPayout,
        connectRequest: connectRequest._id,
        description:    `Session payout — full rate received`,
        balanceAfter:   mentorWallet.balance,
      },
    ],
    { session: mongoSession, ordered: true }
  );

  // ── Credit admin wallet AFTER commit (outside session) ────
  // Done via $inc to avoid session conflict with AdminUser collection
  setImmediate(async () => {
    try {
      await AdminUser.findOneAndUpdate(
        { isActive: true },
        { $inc: { walletBalance: commissionAmount } }
      );
      console.log(`✅ Admin wallet credited: +${commissionAmount} tokens`);
    } catch (err) {
      console.error("❌ Admin wallet credit failed:", err.message);
    }
  });

  console.log(`✅ Escrow released — mentee paid: ${totalAmount} | platform: ${commissionAmount} (${commissionRate}%) | mentor: ${mentorPayout}`);

  return {
    totalAmount,
    commissionRate,
    commissionAmount,
    mentorPayout,
    menteeEscrow:  menteeWallet.escrow,
    mentorBalance: mentorWallet.balance,
  };
};

module.exports = releaseEscrow;