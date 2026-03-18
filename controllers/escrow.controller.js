// backend/controllers/escrow.controller.js
const mongoose       = require("mongoose");
const ConnectRequest = require("../models/ConnectRequest");
const Wallet         = require("../models/Wallet");
const Transaction    = require("../models/Transaction");
const AdminUser      = require("../models/AdminUser");
const sendInvoiceEmail = require("../utils/sendInvoiceEmail");

// ─────────────────────────────────────────────────────────────
// Helper — fetch active admin OUTSIDE transaction (read-only)
// ─────────────────────────────────────────────────────────────
const getAdmin = async () => {
  const admin = await AdminUser.findOne({ isActive: true })
    .select("commissionRate walletBalance");
  if (!admin) throw new Error("Platform admin not found. Contact support.");
  return admin;
};

// ─────────────────────────────────────────────────────────────
// POST /api/escrow/pay
// mentorAmount = sessionRate × sessionCount
// platformFee  = ceil(mentorAmount × commissionRate / 100)
// totalAmount  = mentorAmount + platformFee  ← mentee pays this
// ─────────────────────────────────────────────────────────────
const pay = async (req, res) => {
  // ── Fetch admin BEFORE opening transaction ────────────────
  let admin, commissionRate;
  try {
    admin          = await getAdmin();
    commissionRate = admin.commissionRate ?? 20;
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { connectRequestId, sessionRate, sessionCount } = req.body;
    const menteeId = req.user._id;

    // ── Validate input ────────────────────────────────────────
    if (!connectRequestId) {
      await session.abortTransaction();
      return res.status(400).json({ message: "connectRequestId is required" });
    }
    if (!sessionRate || sessionRate < 1) {
      await session.abortTransaction();
      return res.status(400).json({ message: "sessionRate must be at least 1" });
    }
    if (!sessionCount || sessionCount < 1) {
      await session.abortTransaction();
      return res.status(400).json({ message: "sessionCount must be at least 1" });
    }

    // ── Calculate amounts ─────────────────────────────────────
    const mentorAmount = sessionRate * sessionCount;
    const platformFee  = Math.ceil((mentorAmount * commissionRate) / 100);
    const totalAmount  = mentorAmount + platformFee;

    // ── Find and verify connect request ───────────────────────
    const connectRequest = await ConnectRequest.findById(connectRequestId)
      .populate("mentee", "name email")
      .populate("mentor", "name email")
      .session(session);

    if (!connectRequest) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Connect request not found" });
    }
    if (connectRequest.mentee._id.toString() !== menteeId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({ message: "Not authorized to pay for this request" });
    }
    if (connectRequest.status !== "accepted") {
      await session.abortTransaction();
      return res.status(400).json({
        message: `Payment only allowed on accepted requests. Current status: ${connectRequest.status}`,
      });
    }
    if (connectRequest.paymentStatus === "paid") {
      await session.abortTransaction();
      return res.status(409).json({ message: "Payment already made for this session" });
    }

    // ── Find mentee wallet and check balance ──────────────────
    const menteeWallet = await Wallet.findOne({ user: menteeId }).session(session);

    if (!menteeWallet) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Mentee wallet not found" });
    }
    if (menteeWallet.balance < totalAmount) {
      await session.abortTransaction();
      return res.status(400).json({
        message:  `Insufficient balance. You have ${menteeWallet.balance} tokens but need ${totalAmount}`,
        balance:  menteeWallet.balance,
        required: totalAmount,
      });
    }

    // ── Deduct from mentee balance → escrow ───────────────────
    menteeWallet.balance -= totalAmount;
    menteeWallet.escrow  += totalAmount;
    await menteeWallet.save({ session });

    // ── Update connect request — snapshot commission at pay time
    connectRequest.sessionRate      = sessionRate;
    connectRequest.sessionCount     = sessionCount;
    connectRequest.totalAmount      = totalAmount;
    connectRequest.commissionRate   = commissionRate;
    connectRequest.commissionAmount = platformFee;
    connectRequest.mentorPayout     = mentorAmount;
    connectRequest.paymentStatus    = "paid";
    connectRequest.status           = "ongoing";
    connectRequest.paidAt           = new Date();
    await connectRequest.save({ session });

    // ── Log escrow_hold transaction ───────────────────────────
    await Transaction.create(
      [
        {
          user:           menteeId,
          type:           "escrow_hold",
          amount:         totalAmount,
          connectRequest: connectRequest._id,
          description:    `Escrow hold — ${sessionCount} session(s) × ${sessionRate} tokens + ${commissionRate}% platform fee`,
          balanceAfter:   menteeWallet.balance,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    // ── Send invoice email (non-blocking) ─────────────────────
    sendInvoiceEmail({
      connectRequestId: connectRequest._id.toString(),
      menteeName:       connectRequest.mentee.name,
      menteeEmail:      connectRequest.mentee.email,
      mentorName:       connectRequest.mentor.name,
      mentorEmail:      connectRequest.mentor.email,
      confirmedSlot:    connectRequest.confirmedSlot,
      sessionRate,
      sessionCount,
      totalAmount,
      paidAt:           connectRequest.paidAt,
    }).then(() => {
      console.log(`✅ Invoice email sent to ${connectRequest.mentee.email}`);
    }).catch((err) => {
      console.error("❌ Invoice email failed:", err.message);
    });

    console.log(`💳 Payment success — mentor: ${mentorAmount} | fee: ${platformFee} (${commissionRate}%) | total: ${totalAmount}`);

    return res.status(200).json({
      message:        "Payment successful. Tokens locked in escrow.",
      mentorAmount,
      platformFee,
      totalAmount,
      commissionRate,
      balance:        menteeWallet.balance,
      escrow:         menteeWallet.escrow,
      paymentStatus:  "paid",
      status:         "ongoing",
    });

  } catch (err) {
    await session.abortTransaction();
    console.error("❌ Escrow pay error:", err);
    return res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};


// ─────────────────────────────────────────────────────────────
// POST /api/escrow/release/:requestId
// Reads commission snapshot stored at pay time — no recalculation
// ─────────────────────────────────────────────────────────────
const release = async (req, res) => {
  // ── Fetch admin BEFORE opening transaction ────────────────
  let admin;
  try {
    admin = await getAdmin();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { requestId } = req.params;
    const menteeId = req.user._id;

    const connectRequest = await ConnectRequest.findById(requestId).session(session);

    if (!connectRequest) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Connect request not found" });
    }
    if (connectRequest.mentee.toString() !== menteeId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({ message: "Only the mentee can confirm session completion" });
    }
    if (connectRequest.status !== "ongoing") {
      await session.abortTransaction();
      return res.status(400).json({
        message: `Release only allowed on ongoing sessions. Current status: ${connectRequest.status}`,
      });
    }
    if (connectRequest.paymentStatus !== "paid") {
      await session.abortTransaction();
      return res.status(400).json({ message: "No escrowed payment found for this session" });
    }

    const {
      totalAmount,
      mentorPayout,
      commissionAmount,
      commissionRate,
      mentor: mentorId,
    } = connectRequest;

    // ── Fetch wallets ─────────────────────────────────────────
    const [menteeWallet, mentorWallet] = await Promise.all([
      Wallet.findOne({ user: menteeId }).session(session),
      Wallet.findOne({ user: mentorId }).session(session),
    ]);

    if (!menteeWallet) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Mentee wallet not found" });
    }
    if (!mentorWallet) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Mentor wallet not found" });
    }
    if (menteeWallet.escrow < totalAmount) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Escrow balance mismatch. Contact support." });
    }

    // ── Settle wallets ────────────────────────────────────────
    menteeWallet.escrow  -= totalAmount;
    mentorWallet.balance += mentorPayout;
    admin.walletBalance  += commissionAmount;

    await menteeWallet.save({ session });
    await mentorWallet.save({ session });
    // ── Save admin OUTSIDE session (AdminUser not in replica set)
    await session.commitTransaction();

    // ── Credit admin wallet after commit ──────────────────────
    await AdminUser.findByIdAndUpdate(admin._id, {
      $inc: { walletBalance: commissionAmount },
    });

    // ── Mark session complete ─────────────────────────────────
    connectRequest.status      = "completed";
    connectRequest.completedAt = new Date();
    await connectRequest.save();

    // ── Log 3 transactions ────────────────────────────────────
    await Transaction.create([
      {
        user:           menteeId,
        type:           "escrow_release",
        amount:         totalAmount,
        connectRequest: connectRequest._id,
        description:    `Escrow released on session completion`,
        balanceAfter:   menteeWallet.escrow,
      },
      {
        user:           mentorId,
        type:           "commission_deduct",
        amount:         commissionAmount,
        connectRequest: connectRequest._id,
        description:    `Platform fee (${commissionRate}%) collected`,
        balanceAfter:   mentorWallet.balance,
      },
      {
        user:           mentorId,
        type:           "mentor_payout",
        amount:         mentorPayout,
        connectRequest: connectRequest._id,
        description:    `Session payout — full rate received`,
        balanceAfter:   mentorWallet.balance,
      },
    ]);

    console.log(`✅ Released — mentee paid: ${totalAmount} | platform: ${commissionAmount} (${commissionRate}%) | mentor: ${mentorPayout}`);

    return res.status(200).json({
      message:         "Session marked complete. Tokens released to mentor.",
      totalAmount,
      commissionRate,
      commissionAmount,
      mentorPayout,
      menteeEscrow:    menteeWallet.escrow,
      status:          "completed",
    });

  } catch (err) {
    try { await session.abortTransaction(); } catch (_) {}
    console.error("❌ Escrow release error:", err);
    return res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};


// ─────────────────────────────────────────────────────────────
// POST /api/escrow/refund/:requestId — NO CHANGES
// ─────────────────────────────────────────────────────────────
const refund = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { requestId } = req.params;
    const userId = req.user._id;

    const connectRequest = await ConnectRequest.findById(requestId).session(session);

    if (!connectRequest) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Connect request not found" });
    }

    const isMentee = connectRequest.mentee.toString() === userId.toString();
    const isMentor = connectRequest.mentor.toString() === userId.toString();

    if (!isMentee && !isMentor) {
      await session.abortTransaction();
      return res.status(403).json({ message: "Not authorized to refund this session" });
    }
    if (connectRequest.paymentStatus !== "paid") {
      await session.abortTransaction();
      return res.status(400).json({ message: "No paid escrow found to refund" });
    }
    if (connectRequest.status === "completed") {
      await session.abortTransaction();
      return res.status(400).json({ message: "Cannot refund a completed session" });
    }

    const { totalAmount, mentee: menteeId } = connectRequest;

    const menteeWallet = await Wallet.findOne({ user: menteeId }).session(session);

    if (!menteeWallet) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Mentee wallet not found" });
    }
    if (menteeWallet.escrow < totalAmount) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Escrow balance mismatch. Contact support." });
    }

    menteeWallet.escrow  -= totalAmount;
    menteeWallet.balance += totalAmount;
    await menteeWallet.save({ session });

    connectRequest.paymentStatus = "refunded";
    connectRequest.status        = "rejected";
    await connectRequest.save({ session });

    await Transaction.create(
      [
        {
          user:           menteeId,
          type:           "escrow_refund",
          amount:         totalAmount,
          connectRequest: connectRequest._id,
          description:    `Full refund — session cancelled (incl. platform fee)`,
          balanceAfter:   menteeWallet.balance,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return res.status(200).json({
      message:       "Escrow refunded successfully. Tokens returned to mentee.",
      totalAmount,
      balance:       menteeWallet.balance,
      escrow:        menteeWallet.escrow,
      status:        "rejected",
      paymentStatus: "refunded",
    });

  } catch (err) {
    await session.abortTransaction();
    console.error("❌ Escrow refund error:", err);
    return res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};


// ─────────────────────────────────────────────────────────────
// GET /api/escrow/status/:requestId — NO CHANGES
// ─────────────────────────────────────────────────────────────
const getStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;

    const connectRequest = await ConnectRequest.findById(requestId)
      .select("mentee mentor status paymentStatus sessionRate sessionCount totalAmount paidAt completedAt confirmedSlot commissionRate commissionAmount mentorPayout")
      .lean();

    if (!connectRequest) {
      return res.status(404).json({ message: "Connect request not found" });
    }

    const isMentee = connectRequest.mentee.toString() === userId.toString();
    const isMentor = connectRequest.mentor.toString() === userId.toString();

    if (!isMentee && !isMentor) {
      return res.status(403).json({ message: "Not authorized to view this session" });
    }

    const menteeWallet = await Wallet.findOne({ user: connectRequest.mentee })
      .select("balance escrow")
      .lean();

    return res.status(200).json({
      status:           connectRequest.status,
      paymentStatus:    connectRequest.paymentStatus,
      sessionRate:      connectRequest.sessionRate,
      sessionCount:     connectRequest.sessionCount,
      totalAmount:      connectRequest.totalAmount,
      commissionRate:   connectRequest.commissionRate,
      commissionAmount: connectRequest.commissionAmount,
      mentorPayout:     connectRequest.mentorPayout,
      paidAt:           connectRequest.paidAt,
      completedAt:      connectRequest.completedAt,
      confirmedSlot:    connectRequest.confirmedSlot,
      wallet: menteeWallet
        ? { balance: menteeWallet.balance, escrow: menteeWallet.escrow }
        : null,
    });

  } catch (err) {
    console.error("❌ Escrow status error:", err);
    return res.status(500).json({ message: err.message });
  }
};


// ─────────────────────────────────────────────────────────────
// GET /api/escrow/wallet — NO CHANGES
// ─────────────────────────────────────────────────────────────
const getMyWallet = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id }).lean();
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }
    return res.status(200).json({
      balance: wallet.balance,
      escrow:  wallet.escrow,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};


module.exports = { pay, release, refund, getStatus, getMyWallet };