// backend/services/escrow.service.js
const mongoose = require("mongoose");
const repo     = require("../repositories/escrow.repository");
const sendInvoiceEmail              = require("../utils/sendInvoiceEmail");
const { sendCalendarInvite }        = require("../utils/sendCalendarInvite");
const { sendPaymentReceivedEmail }  = require("../utils/sendNotificationEmail");

// ─────────────────────────────────────────────────────────────
// pay — lock tokens into escrow
// ─────────────────────────────────────────────────────────────
const pay = async ({ connectRequestId, sessionRate, sessionCount, menteeId }) => {
  // Validate input
  if (!connectRequestId)                  throw Object.assign(new Error("connectRequestId is required"), { status: 400 });
  if (!sessionRate  || sessionRate  < 1)  throw Object.assign(new Error("sessionRate must be at least 1"), { status: 400 });
  if (!sessionCount || sessionCount < 1)  throw Object.assign(new Error("sessionCount must be at least 1"), { status: 400 });

  // Fetch admin outside transaction (read-only)
  const admin = await repo.findActiveAdmin();
  if (!admin) throw Object.assign(new Error("Platform admin not found. Contact support."), { status: 500 });

  const commissionRate = admin.commissionRate ?? 20;
  const mentorAmount   = sessionRate * sessionCount;
  const platformFee    = Math.ceil((mentorAmount * commissionRate) / 100);
  const totalAmount    = mentorAmount + platformFee;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Fetch & validate connect request
    const connectRequest = await repo.findConnectRequestById(connectRequestId, session);
    if (!connectRequest)
      throw Object.assign(new Error("Connect request not found"), { status: 404 });
    if (connectRequest.mentee._id.toString() !== menteeId.toString())
      throw Object.assign(new Error("Not authorized to pay for this request"), { status: 403 });
    if (connectRequest.status !== "accepted")
      throw Object.assign(new Error(`Payment only allowed on accepted requests. Current status: ${connectRequest.status}`), { status: 400 });
    if (connectRequest.paymentStatus === "paid")
      throw Object.assign(new Error("Payment already made for this session"), { status: 409 });

    // Fetch & validate mentee wallet
    const menteeWallet = await repo.findWalletByUser(menteeId, session);
    if (!menteeWallet)
      throw Object.assign(new Error("Mentee wallet not found"), { status: 404 });
    if (menteeWallet.balance < totalAmount)
      throw Object.assign(
        new Error(`Insufficient balance. You have ${menteeWallet.balance} tokens but need ${totalAmount}`),
        { status: 400, balance: menteeWallet.balance, required: totalAmount }
      );

    // Deduct from balance → escrow
    menteeWallet.balance -= totalAmount;
    menteeWallet.escrow  += totalAmount;
    await repo.saveWallet(menteeWallet, session);

    // Snapshot commission on connect request
    Object.assign(connectRequest, {
      sessionRate,
      sessionCount,
      totalAmount,
      commissionRate,
      commissionAmount: platformFee,
      mentorPayout:     mentorAmount,
      paymentStatus:    "paid",
      status:           "ongoing",
      paidAt:           new Date(),
    });
    await repo.saveConnectRequest(connectRequest, session);

    // Log escrow_hold transaction
    await repo.createTransactions(
      [{
        user:           menteeId,
        type:           "escrow_hold",
        amount:         totalAmount,
        connectRequest: connectRequest._id,
        description:    `Escrow hold — ${sessionCount} session(s) × ${sessionRate} tokens + ${commissionRate}% platform fee`,
        balanceAfter:   menteeWallet.balance,
      }],
      session
    );

    await session.commitTransaction();

    // Fire-and-forget side effects
    _sendPayInvoiceEmail(connectRequest, { sessionRate, sessionCount, totalAmount, mentorAmount, commissionRate });

    return {
      mentorAmount,
      platformFee,
      totalAmount,
      commissionRate,
      balance:       menteeWallet.balance,
      escrow:        menteeWallet.escrow,
      paymentStatus: "paid",
      status:        "ongoing",
    };

  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────
// release — settle escrow to mentor + platform
// ─────────────────────────────────────────────────────────────
const release = async ({ requestId, menteeId }) => {
  const admin = await repo.findActiveAdmin();
  if (!admin) throw Object.assign(new Error("Platform admin not found. Contact support."), { status: 500 });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const connectRequest = await repo.findConnectRequestRaw(requestId, session);
    if (!connectRequest)
      throw Object.assign(new Error("Connect request not found"), { status: 404 });
    if (connectRequest.mentee.toString() !== menteeId.toString())
      throw Object.assign(new Error("Only the mentee can confirm session completion"), { status: 403 });
    if (connectRequest.status !== "ongoing")
      throw Object.assign(new Error(`Release only allowed on ongoing sessions. Current status: ${connectRequest.status}`), { status: 400 });
    if (connectRequest.paymentStatus !== "paid")
      throw Object.assign(new Error("No escrowed payment found for this session"), { status: 400 });

    const { totalAmount, mentorPayout, commissionAmount, commissionRate, mentor: mentorId } = connectRequest;

    const [menteeWallet, mentorWallet] = await Promise.all([
      repo.findWalletByUser(menteeId, session),
      repo.findWalletByUser(mentorId, session),
    ]);

    if (!menteeWallet) throw Object.assign(new Error("Mentee wallet not found"), { status: 404 });
    if (!mentorWallet) throw Object.assign(new Error("Mentor wallet not found"), { status: 404 });
    if (menteeWallet.escrow < totalAmount)
      throw Object.assign(new Error("Escrow balance mismatch. Contact support."), { status: 400 });

    // Settle wallets
    menteeWallet.escrow  -= totalAmount;
    mentorWallet.balance += mentorPayout;

    await repo.saveWallet(menteeWallet, session);
    await repo.saveWallet(mentorWallet, session);

    await session.commitTransaction();

    // Credit admin outside session (AdminUser not in replica set)
    await repo.creditAdmin(admin._id, commissionAmount);

    // Mark complete
    connectRequest.status      = "completed";
    connectRequest.completedAt = new Date();
    await repo.saveConnectRequest(connectRequest);

    // Increment mentor session count
    await repo.incrementMentorSessions(mentorId);

    // Log transactions
    await repo.createTransactions([
      {
        user:           menteeId,
        type:           "escrow_release",
        amount:         totalAmount,
        connectRequest: connectRequest._id,
        description:    "Escrow released on session completion",
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
        description:    "Session payout — full rate received",
        balanceAfter:   mentorWallet.balance,
      },
    ]);

    return {
      totalAmount,
      commissionRate,
      commissionAmount,
      mentorPayout,
      menteeEscrow: menteeWallet.escrow,
      status:       "completed",
    };

  } catch (err) {
    try { await session.abortTransaction(); } catch (_) {}
    throw err;
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────
// refund — return ALL escrowed tokens to mentee (full session cancel)
// ─────────────────────────────────────────────────────────────
const refund = async ({ requestId, userId }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const connectRequest = await repo.findConnectRequestRaw(requestId, session);
    if (!connectRequest)
      throw Object.assign(new Error("Connect request not found"), { status: 404 });

    const isMentee = connectRequest.mentee.toString() === userId.toString();
    const isMentor = connectRequest.mentor.toString() === userId.toString();

    if (!isMentee && !isMentor)
      throw Object.assign(new Error("Not authorized to refund this session"), { status: 403 });
    if (connectRequest.paymentStatus !== "paid")
      throw Object.assign(new Error("No paid escrow found to refund"), { status: 400 });
    if (connectRequest.status === "completed")
      throw Object.assign(new Error("Cannot refund a completed session"), { status: 400 });

    const { totalAmount, mentee: menteeId } = connectRequest;

    const menteeWallet = await repo.findWalletByUser(menteeId, session);
    if (!menteeWallet)
      throw Object.assign(new Error("Mentee wallet not found"), { status: 404 });
    if (menteeWallet.escrow < totalAmount)
      throw Object.assign(new Error("Escrow balance mismatch. Contact support."), { status: 400 });

    menteeWallet.escrow  -= totalAmount;
    menteeWallet.balance += totalAmount;
    await repo.saveWallet(menteeWallet, session);

    connectRequest.paymentStatus = "refunded";
    connectRequest.status        = "rejected";
    await repo.saveConnectRequest(connectRequest, session);

    await repo.createTransactions(
      [{
        user:           menteeId,
        type:           "escrow_refund",
        amount:         totalAmount,
        connectRequest: connectRequest._id,
        description:    "Full refund — session cancelled (incl. platform fee)",
        balanceAfter:   menteeWallet.balance,
      }],
      session
    );

    await session.commitTransaction();

    return {
      totalAmount,
      balance:       menteeWallet.balance,
      escrow:        menteeWallet.escrow,
      status:        "rejected",
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
// ✅ NEW — refundSlot — partial refund for a single cancelled slot
// Called automatically from cancelSlot in session.controller.js
// Does NOT change connectRequest.paymentStatus or status —
// the session stays "ongoing" with remaining slots intact.
// ─────────────────────────────────────────────────────────────
const refundSlot = async ({ connectRequestId, slotIndex, cancelledBy }) => {
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    const connectRequest = await repo.findConnectRequestRaw(connectRequestId, mongoSession);
    if (!connectRequest)
      throw Object.assign(new Error("Connect request not found"), { status: 404 });

    if (connectRequest.paymentStatus !== "paid")
      throw Object.assign(new Error("No paid escrow found for this session"), { status: 400 });

    const { totalAmount, sessionCount, mentee: menteeId } = connectRequest;

    // Need sessionCount to calculate per-slot value
    if (!sessionCount || sessionCount < 1)
      throw Object.assign(new Error("Session count missing on connect request"), { status: 400 });

    // Per-slot refund = totalAmount ÷ sessionCount
    // Math.floor — platform keeps fractional tokens (no over-refund)
    const perSlotRefund = Math.floor(totalAmount / sessionCount);

    if (perSlotRefund < 1)
      throw Object.assign(new Error("Slot refund amount is too small to process"), { status: 400 });

    const menteeWallet = await repo.findWalletByUser(menteeId, mongoSession);
    if (!menteeWallet)
      throw Object.assign(new Error("Mentee wallet not found"), { status: 404 });
    if (menteeWallet.escrow < perSlotRefund)
      throw Object.assign(new Error("Escrow balance too low for slot refund. Contact support."), { status: 400 });

    // Move tokens: escrow → balance (instant refund)
    menteeWallet.escrow  -= perSlotRefund;
    menteeWallet.balance += perSlotRefund;
    await repo.saveWallet(menteeWallet, mongoSession);

    // Log the partial refund transaction
    await repo.createTransactions(
      [{
        user:           menteeId,
        type:           "escrow_refund",
        amount:         perSlotRefund,
        connectRequest: connectRequest._id,
        description:    `Slot #${slotIndex + 1} cancelled by ${cancelledBy} — partial refund of ${perSlotRefund} tokens`,
        balanceAfter:   menteeWallet.balance,
      }],
      mongoSession
    );

    await mongoSession.commitTransaction();

    return {
      refundedAmount: perSlotRefund,
      balance:        menteeWallet.balance,
      escrow:         menteeWallet.escrow,
    };

  } catch (err) {
    await mongoSession.abortTransaction();
    throw err;
  } finally {
    mongoSession.endSession();
  }
};

// ─────────────────────────────────────────────────────────────
// getStatus — fetch escrow state for a connect request
// ─────────────────────────────────────────────────────────────
const getStatus = async ({ requestId, userId }) => {
  const connectRequest = await repo.findConnectRequestByIdLean(requestId);
  if (!connectRequest)
    throw Object.assign(new Error("Connect request not found"), { status: 404 });

  const isMentee = connectRequest.mentee.toString() === userId.toString();
  const isMentor = connectRequest.mentor.toString() === userId.toString();
  if (!isMentee && !isMentor)
    throw Object.assign(new Error("Not authorized to view this session"), { status: 403 });

  const admin        = await repo.findActiveAdmin();
  const commissionRate = admin?.commissionRate ?? 20;

  const menteeWallet = await repo.findWalletByUserLean(connectRequest.mentee);

  return {
    status:        connectRequest.status,
    paymentStatus: connectRequest.paymentStatus,
    sessionRate:   connectRequest.sessionRate,
    sessionCount:  connectRequest.sessionCount,
    totalAmount:   connectRequest.totalAmount,
    paidAt:        connectRequest.paidAt,
    completedAt:   connectRequest.completedAt,
    confirmedSlot: connectRequest.confirmedSlot,
    commissionRate,
    wallet: menteeWallet
      ? { balance: menteeWallet.balance, escrow: menteeWallet.escrow }
      : null,
  };
};

// ─────────────────────────────────────────────────────────────
// getMyWallet — return caller's wallet balances
// ─────────────────────────────────────────────────────────────
const getMyWallet = async (userId) => {
  const wallet = await repo.findWalletByUserLean(userId);
  if (!wallet) throw Object.assign(new Error("Wallet not found"), { status: 404 });
  return { balance: wallet.balance, escrow: wallet.escrow };
};

// ─────────────────────────────────────────────────────────────
// Private helpers — fire-and-forget emails / calendar
// ─────────────────────────────────────────────────────────────
const _sendPayInvoiceEmail = (connectRequest, { sessionRate, sessionCount, totalAmount, mentorAmount, commissionRate }) => {
  sendInvoiceEmail({
    connectRequestId: connectRequest._id.toString(),
    menteeName:       connectRequest.mentee.name,
    menteeEmail:      connectRequest.mentee.email,
    mentorName:       connectRequest.mentor.name,
    mentorEmail:      connectRequest.mentor.email,
    selectedSlots:    connectRequest.selectedSlots,
    confirmedSlot:    connectRequest.confirmedSlot,
    sessionRate,
    sessionCount,
    totalAmount,
    paidAt:           connectRequest.paidAt,
  })
    .then(() => console.log(`✅ Invoice email sent to ${connectRequest.mentee.email}`))
    .catch((err) => console.error("❌ Invoice email failed:", err.message));

  sendPaymentReceivedEmail({
    mentorName:    connectRequest.mentor.name,
    mentorEmail:   connectRequest.mentor.email,
    menteeName:    connectRequest.mentee.name,
    slots:         connectRequest.selectedSlots,
    sessionRate,
    sessionCount,
    mentorPayout:  mentorAmount,
    commissionRate,
  }).catch((err) => console.error("❌ Payment received email failed:", err.message));

  repo.findMentorTimezone(connectRequest.mentor._id)
    .then((availability) =>
      sendCalendarInvite({
        requestId:   connectRequest._id.toString(),
        mentorName:  connectRequest.mentor.name,
        mentorEmail: connectRequest.mentor.email,
        menteeName:  connectRequest.mentee.name,
        menteeEmail: connectRequest.mentee.email,
        slots:       connectRequest.selectedSlots.map(({ date, startTime, endTime }) => ({ date, startTime, endTime })),
        timezone:    availability?.timezone || "Asia/Kolkata",
        message:     connectRequest.message || "",
      })
    )
    .then(() => console.log(`✅ Calendar invite sent to ${connectRequest.mentee.email}`))
    .catch((err) => console.error("❌ Calendar invite failed:", err.message));
};

module.exports = { pay, release, refund, refundSlot, getStatus, getMyWallet };