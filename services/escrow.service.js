// backend/services/escrow.service.js
const mongoose = require("mongoose");
const repo = require("../repositories/escrow.repository");
const AppError = require("../utils/AppError");
const sendInvoiceEmail = require("../utils/sendInvoiceEmail");
const { sendCalendarInvite } = require("../utils/sendCalendarInvite");
const { sendPaymentReceivedEmail } = require("../utils/sendNotificationEmail");

// ─────────────────────────────────────────────────────────────
// Internal helper — require active admin (read-only, outside tx)
// ─────────────────────────────────────────────────────────────
const requireAdmin = async () => {
  const admin = await repo.findActiveAdmin();
  if (!admin) throw new AppError(500, "Platform admin not found. Contact support.");
  return admin;
};

// ─────────────────────────────────────────────────────────────
// Private — fire-and-forget emails + calendar invite after pay
// ─────────────────────────────────────────────────────────────
const dispatchPaySideEffects = (connectRequest, { sessionRate, sessionCount, totalAmount, mentorAmount, commissionRate }) => {
  sendInvoiceEmail({
    connectRequestId: connectRequest._id.toString(),
    menteeName: connectRequest.mentee.name,
    menteeEmail: connectRequest.mentee.email,
    mentorName: connectRequest.mentor.name,
    mentorEmail: connectRequest.mentor.email,
    selectedSlots: connectRequest.selectedSlots,
    confirmedSlot: connectRequest.confirmedSlot,
    sessionRate,
    sessionCount,
    totalAmount,
    paidAt: connectRequest.paidAt,
  })
    .then(() => console.log(`✅ Invoice email sent to ${connectRequest.mentee.email}`))
    .catch((err) => console.error("❌ Invoice email failed:", err.message));

  sendPaymentReceivedEmail({
    mentorName: connectRequest.mentor.name,
    mentorEmail: connectRequest.mentor.email,
    menteeName: connectRequest.mentee.name,
    slots: connectRequest.selectedSlots,
    sessionRate,
    sessionCount,
    mentorPayout: mentorAmount,
    commissionRate,
  }).catch((err) => console.error("❌ Payment received email failed:", err.message));

  repo.findMentorTimezone(connectRequest.mentor._id)
    .then((availability) =>
      sendCalendarInvite({
        requestId: connectRequest._id.toString(),
        mentorName: connectRequest.mentor.name,
        mentorEmail: connectRequest.mentor.email,
        menteeName: connectRequest.mentee.name,
        menteeEmail: connectRequest.mentee.email,
        slots: connectRequest.selectedSlots.map(({ date, startTime, endTime }) => ({ date, startTime, endTime })),
        timezone: availability?.timezone || "Asia/Kolkata",
        message: connectRequest.message || "",
      })
    )
    .then(() => console.log(`✅ Calendar invite sent to ${connectRequest.mentee.email}`))
    .catch((err) => console.error("❌ Calendar invite failed:", err.message));
};

// ─────────────────────────────────────────────────────────────
// PAY — lock tokens into escrow
// ─────────────────────────────────────────────────────────────
const pay = async ({ connectRequestId, sessionRate, sessionCount, menteeId }) => {
  if (!connectRequestId) throw new AppError(400, "connectRequestId is required");
  if (!sessionRate || sessionRate < 1) throw new AppError(400, "sessionRate must be at least 1");
  if (!sessionCount || sessionCount < 1) throw new AppError(400, "sessionCount must be at least 1");

  const admin = await requireAdmin();
  const commissionRate = admin.commissionRate ?? 20;
  const mentorAmount = sessionRate * sessionCount;
  const platformFee = Math.ceil((mentorAmount * commissionRate) / 100);
  const totalAmount = mentorAmount + platformFee;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const connectRequest = await repo.findConnectRequestById(connectRequestId, session);

    if (!connectRequest)
      throw new AppError(404, "Connect request not found");
    if (connectRequest.mentee._id.toString() !== menteeId.toString())
      throw new AppError(403, "Not authorized to pay for this request");
    if (connectRequest.status !== "accepted")
      throw new AppError(400, `Payment only allowed on accepted requests. Current status: ${connectRequest.status}`);
    if (connectRequest.paymentStatus === "paid")
      throw new AppError(409, "Payment already made for this session");

    const menteeWallet = await repo.findWalletByUser(menteeId, session);

    if (!menteeWallet)
      throw new AppError(404, "Mentee wallet not found");
    if (menteeWallet.balance < totalAmount)
      throw new AppError(400, `Insufficient balance. You have ${menteeWallet.balance} tokens but need ${totalAmount}`);

    menteeWallet.balance -= totalAmount;
    menteeWallet.escrow += totalAmount;
    await repo.saveWallet(menteeWallet, session);

    Object.assign(connectRequest, {
      sessionRate,
      sessionCount,
      totalAmount,
      commissionRate,
      commissionAmount: platformFee,
      mentorPayout: mentorAmount,
      paymentStatus: "paid",
      status: "ongoing",
      paidAt: new Date(),
    });
    await repo.saveConnectRequest(connectRequest, session);

    await repo.createTransactions([{
      user: menteeId,
      type: "escrow_hold",
      amount: totalAmount,
      connectRequest: connectRequest._id,
      description: `Escrow hold — ${sessionCount} session(s) × ${sessionRate} tokens + ${commissionRate}% platform fee`,
      balanceAfter: menteeWallet.balance,
    }], session);

    await session.commitTransaction();

    console.log(`💳 Payment success — mentor: ${mentorAmount} | fee: ${platformFee} (${commissionRate}%) | total: ${totalAmount}`);

    dispatchPaySideEffects(connectRequest, { sessionRate, sessionCount, totalAmount, mentorAmount, commissionRate });

    return {
      mentorAmount,
      platformFee,
      totalAmount,
      commissionRate,
      balance: menteeWallet.balance,
      escrow: menteeWallet.escrow,
      paymentStatus: "paid",
      status: "ongoing",
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────
// RELEASE — settle escrow to mentor + platform
// ─────────────────────────────────────────────────────────────
const release = async ({ requestId, menteeId }) => {
  const admin = await requireAdmin();
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const connectRequest = await repo.findConnectRequestRaw(requestId, session);

    if (!connectRequest)
      throw new AppError(404, "Connect request not found");
    if (connectRequest.mentee.toString() !== menteeId.toString())
      throw new AppError(403, "Only the mentee can confirm session completion");
    if (connectRequest.status !== "ongoing")
      throw new AppError(400, `Release only allowed on ongoing sessions. Current status: ${connectRequest.status}`);
    if (connectRequest.paymentStatus !== "paid")
      throw new AppError(400, "No escrowed payment found for this session");

    const { totalAmount, mentorPayout, commissionAmount, commissionRate, mentor: mentorId } = connectRequest;

    const [menteeWallet, mentorWallet] = await Promise.all([
      repo.findWalletByUser(menteeId, session),
      repo.findWalletByUser(mentorId, session),
    ]);

    if (!menteeWallet) throw new AppError(404, "Mentee wallet not found");
    if (!mentorWallet) throw new AppError(404, "Mentor wallet not found");
    if (menteeWallet.escrow < totalAmount)
      throw new AppError(400, "Escrow balance mismatch. Contact support.");

    menteeWallet.escrow -= totalAmount;
    mentorWallet.balance += mentorPayout;

    await repo.saveWallet(menteeWallet, session);
    await repo.saveWallet(mentorWallet, session);

    // Commit before touching AdminUser (not in replica set)
    await session.commitTransaction();

    await repo.creditAdmin(admin._id, commissionAmount);

    connectRequest.status = "completed";
    connectRequest.completedAt = new Date();
    await repo.saveConnectRequest(connectRequest);

    await repo.incrementMentorSessions(mentorId);

    await repo.createTransactions([
      {
        user: menteeId,
        type: "escrow_release",
        amount: totalAmount,
        connectRequest: connectRequest._id,
        description: "Escrow released on session completion",
        balanceAfter: menteeWallet.escrow,
      },
      {
        user: mentorId,
        type: "commission_deduct",
        amount: commissionAmount,
        connectRequest: connectRequest._id,
        description: `Platform fee (${commissionRate}%) collected`,
        balanceAfter: mentorWallet.balance,
      },
      {
        user: mentorId,
        type: "mentor_payout",
        amount: mentorPayout,
        connectRequest: connectRequest._id,
        description: "Session payout — full rate received",
        balanceAfter: mentorWallet.balance,
      },
    ]);

    console.log(`✅ Released — mentee paid: ${totalAmount} | platform: ${commissionAmount} (${commissionRate}%) | mentor: ${mentorPayout}`);

    return {
      totalAmount,
      commissionRate,
      commissionAmount,
      mentorPayout,
      menteeEscrow: menteeWallet.escrow,
      status: "completed",
    };
  } catch (err) {
    // abortTransaction can throw if session already closed — log and swallow safely
    try { await session.abortTransaction(); } catch (abortErr) {
      console.warn("⚠️ abortTransaction failed:", abortErr.message);
    }
    throw err;
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────
// REFUND — return ALL escrowed tokens to mentee (full cancel)
// ─────────────────────────────────────────────────────────────
const refund = async ({ requestId, userId }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const connectRequest = await repo.findConnectRequestRaw(requestId, session);

    if (!connectRequest)
      throw new AppError(404, "Connect request not found");

    const isMentee = connectRequest.mentee.toString() === userId.toString();
    const isMentor = connectRequest.mentor.toString() === userId.toString();

    if (!isMentee && !isMentor)
      throw new AppError(403, "Not authorized to refund this session");
    if (connectRequest.paymentStatus !== "paid")
      throw new AppError(400, "No paid escrow found to refund");
    if (connectRequest.status === "completed")
      throw new AppError(400, "Cannot refund a completed session");

    const { totalAmount, mentee: menteeId } = connectRequest;

    const menteeWallet = await repo.findWalletByUser(menteeId, session);

    if (!menteeWallet)
      throw new AppError(404, "Mentee wallet not found");
    if (menteeWallet.escrow < totalAmount)
      throw new AppError(400, "Escrow balance mismatch. Contact support.");

    menteeWallet.escrow -= totalAmount;
    menteeWallet.balance += totalAmount;
    await repo.saveWallet(menteeWallet, session);

    connectRequest.paymentStatus = "refunded";
    connectRequest.status = "rejected";
    await repo.saveConnectRequest(connectRequest, session);

    await repo.createTransactions([{
      user: menteeId,
      type: "escrow_refund",
      amount: totalAmount,
      connectRequest: connectRequest._id,
      description: "Full refund — session cancelled (incl. platform fee)",
      balanceAfter: menteeWallet.balance,
    }], session);

    await session.commitTransaction();

    return {
      totalAmount,
      balance: menteeWallet.balance,
      escrow: menteeWallet.escrow,
      status: "rejected",
      paymentStatus: "refunded",
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────
// REFUND SLOT — partial refund for a single cancelled slot
// ─────────────────────────────────────────────────────────────
const refundSlot = async ({ connectRequestId, slotIndex, cancelledBy }) => {
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    const connectRequest = await repo.findConnectRequestRaw(connectRequestId, mongoSession);

    if (!connectRequest)
      throw new AppError(404, "Connect request not found");
    if (connectRequest.paymentStatus !== "paid")
      throw new AppError(400, "No paid escrow found for this session");

    const { totalAmount, sessionCount, mentee: menteeId } = connectRequest;

    if (!sessionCount || sessionCount < 1)
      throw new AppError(400, "Session count missing on connect request");

    const perSlotRefund = Math.floor(totalAmount / sessionCount);

    if (perSlotRefund < 1)
      throw new AppError(400, "Slot refund amount is too small to process");

    const menteeWallet = await repo.findWalletByUser(menteeId, mongoSession);

    if (!menteeWallet)
      throw new AppError(404, "Mentee wallet not found");
    if (menteeWallet.escrow < perSlotRefund)
      throw new AppError(400, "Escrow balance too low for slot refund. Contact support.");

    menteeWallet.escrow -= perSlotRefund;
    menteeWallet.balance += perSlotRefund;
    await repo.saveWallet(menteeWallet, mongoSession);

    await repo.createTransactions([{
      user: menteeId,
      type: "escrow_refund",
      amount: perSlotRefund,
      connectRequest: connectRequest._id,
      description: `Slot #${slotIndex + 1} cancelled by ${cancelledBy} — partial refund of ${perSlotRefund} tokens`,
      balanceAfter: menteeWallet.balance,
    }], mongoSession);

    await mongoSession.commitTransaction();

    return {
      refundedAmount: perSlotRefund,
      balance: menteeWallet.balance,
      escrow: menteeWallet.escrow,
    };
  } catch (err) {
    await mongoSession.abortTransaction();
    throw err;
  } finally {
    mongoSession.endSession();
  }
};

// ─────────────────────────────────────────────────────────────
// GET STATUS
// ─────────────────────────────────────────────────────────────
const getStatus = async ({ requestId, userId }) => {
  const connectRequest = await repo.findConnectRequestByIdLean(requestId);

  if (!connectRequest)
    throw new AppError(404, "Connect request not found");

  const isMentee = connectRequest.mentee.toString() === userId.toString();
  const isMentor = connectRequest.mentor.toString() === userId.toString();

  if (!isMentee && !isMentor)
    throw new AppError(403, "Not authorized to view this session");

  const admin = await repo.findActiveAdmin();
  const commissionRate = admin?.commissionRate ?? 20;
  const menteeWallet = await repo.findWalletByUserLean(connectRequest.mentee);

  return {
    status: connectRequest.status,
    paymentStatus: connectRequest.paymentStatus,
    sessionRate: connectRequest.sessionRate,
    sessionCount: connectRequest.sessionCount,
    totalAmount: connectRequest.totalAmount,
    paidAt: connectRequest.paidAt,
    completedAt: connectRequest.completedAt,
    confirmedSlot: connectRequest.confirmedSlot,
    commissionRate,
    wallet: menteeWallet
      ? { balance: menteeWallet.balance, escrow: menteeWallet.escrow }
      : null,
  };
};

// ─────────────────────────────────────────────────────────────
// GET MY WALLET
// ─────────────────────────────────────────────────────────────
const getMyWallet = async (userId) => {
  const wallet = await repo.findWalletByUserLean(userId);
  if (!wallet) throw new AppError(404, "Wallet not found");
  return { balance: wallet.balance, escrow: wallet.escrow };
};

// ─────────────────────────────────────────────────────────────
// GET COMMISSION RATE
// ─────────────────────────────────────────────────────────────
const getCommissionRate = async () => {
  const admin = await repo.findActiveAdmin();
  // FIX: optional chain replaces `!admin || admin.commissionRate == null`
  if (admin?.commissionRate == null)
    throw new AppError(404, "Commission rate not configured");
  return { commissionRate: admin.commissionRate };
};

// ─────────────────────────────────────────────────────────────
// PAY ADDITIONAL — escrow for a single extra slot
// ─────────────────────────────────────────────────────────────
const payAdditional = async ({ connectRequestId, sessionRate, slotId, menteeId }) => {
  if (!connectRequestId || !sessionRate || !slotId)
    throw new AppError(400, "connectRequestId, sessionRate, and slotId are required");
  if (sessionRate < 1)
    throw new AppError(400, "sessionRate must be at least 1");

  const admin = await requireAdmin();
  const commissionRate = admin.commissionRate ?? 20;
  const platformFee = Math.ceil((sessionRate * commissionRate) / 100);
  const totalAmount = sessionRate + platformFee;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const connectRequest = await repo.findConnectRequestById(connectRequestId, session);

    if (!connectRequest)
      throw new AppError(404, "Connect request not found");
    if (connectRequest.mentee._id.toString() !== menteeId.toString())
      throw new AppError(403, "Not authorized");
    if (connectRequest.status !== "ongoing")
      throw new AppError(400, "Additional payment only allowed on ongoing sessions");

    const additionalSlot = connectRequest.additionalSlots?.id(slotId);
    if (!additionalSlot)
      throw new AppError(404, "Additional slot not found");
    if (additionalSlot.paymentStatus === "paid")
      throw new AppError(409, "This slot has already been paid for");

    const menteeWallet = await repo.findWalletByUser(menteeId, session);

    if (!menteeWallet)
      throw new AppError(404, "Mentee wallet not found");
    if (menteeWallet.balance < totalAmount)
      throw new AppError(400, `Insufficient balance. You have ${menteeWallet.balance} tokens but need ${totalAmount}`);

    menteeWallet.balance -= totalAmount;
    menteeWallet.escrow += totalAmount;
    await repo.saveWallet(menteeWallet, session);

    additionalSlot.paymentStatus = "paid";
    additionalSlot.paidAt = new Date();
    additionalSlot.sessionRate = sessionRate;
    additionalSlot.totalAmount = totalAmount;
    await repo.saveConnectRequest(connectRequest, session);

    await repo.createTransactions([{
      user: menteeId,
      type: "escrow_hold",
      amount: totalAmount,
      connectRequest: connectRequest._id,
      description: `Escrow hold — additional session × ${sessionRate} tokens + ${commissionRate}% platform fee`,
      balanceAfter: menteeWallet.balance,
    }], session);

    await session.commitTransaction();

    console.log(`💳 Additional session payment — fee: ${platformFee} (${commissionRate}%) | total: ${totalAmount}`);

    return {
      sessionRate,
      platformFee,
      totalAmount,
      commissionRate,
      balance: menteeWallet.balance,
      escrow: menteeWallet.escrow,
      slotId,
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

module.exports = {
  pay,
  payAdditional,
  release,
  refund,
  refundSlot,
  getStatus,
  getMyWallet,
  getCommissionRate,
};