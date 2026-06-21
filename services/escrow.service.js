// backend/services/escrow.service.js
const mongoose = require("mongoose");
const AppError = require("../utils/appError");
const sendInvoiceEmail = require("../utils/sendInvoiceEmail");
const { sendCalendarInvite } = require("../utils/sendCalendarInvite");
const { sendPaymentReceivedEmail } = require("../utils/emails");
const { DEFAULT_COMMISSION_RATE, PLATFORM_TIMEZONE } = require("../config/constants");
const createEscrowService = (repo, { logger }) => {
const requireAdmin = async () => {
  const admin = await repo.findActiveAdmin();
  if (!admin) throw new AppError(500, "Platform admin not found. Contact support.");
  return admin;
};

const dispatchPaySideEffects = (
  connectRequest,
  { sessionRate, sessionCount, totalAmount, mentorAmount, commissionRate }
) => {
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
    .then(() => logger.info("Invoice email sent", { connectRequestId: connectRequest._id.toString() }))
    .catch((err) => logger.error("Invoice email failed", { error: err.message, connectRequestId: connectRequest._id.toString() }));

  sendPaymentReceivedEmail({
    mentorName: connectRequest.mentor.name,
    mentorEmail: connectRequest.mentor.email,
    menteeName: connectRequest.mentee.name,
    slots: connectRequest.selectedSlots,
    sessionRate,
    sessionCount,
    mentorPayout: mentorAmount,
    commissionRate,
  }).catch((err) => logger.error("Payment received email failed", { error: err.message }));

  (async () => {
    try {
      const availability = await repo.findMentorTimezone(connectRequest.mentor._id);
      await sendCalendarInvite({
        requestId: connectRequest._id.toString(),
        mentorName: connectRequest.mentor.name,
        mentorEmail: connectRequest.mentor.email,
        menteeName: connectRequest.mentee.name,
        menteeEmail: connectRequest.mentee.email,
        slots: connectRequest.selectedSlots.map(({ date, startTime, endTime }) => ({ date, startTime, endTime })),
        timezone: availability?.timezone || PLATFORM_TIMEZONE,
        message: connectRequest.message || "",
      });
      logger.info("Calendar invite sent", { connectRequestId: connectRequest._id.toString() });
    } catch (err) {
      logger.error("Calendar invite failed", { error: err.message, connectRequestId: connectRequest._id.toString() });
    }
  })(); 
};

// PAY
const pay = async ({ connectRequestId, sessionRate, sessionCount, menteeId }) => {
  if (!connectRequestId) throw new AppError(400, "connectRequestId is required");   // keep 400 — missing field
  if (!sessionRate || sessionRate < 1) throw new AppError(422, "sessionRate must be at least 1");   // 422 — value invalid
  if (!sessionCount || sessionCount < 1) throw new AppError(422, "sessionCount must be at least 1"); // 422

  const admin = await requireAdmin();
  const commissionRate = admin.commissionRate ?? DEFAULT_COMMISSION_RATE;
  const mentorAmount = sessionRate * sessionCount;
  const platformFee = Math.ceil((mentorAmount * commissionRate) / 100);
  const totalAmount = mentorAmount + platformFee;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const connectRequest = await repo.findConnectRequestById(connectRequestId, session);

    if (!connectRequest) throw new AppError(404, "Connect request not found");
    if (connectRequest.mentee._id.toString() !== menteeId.toString())
      throw new AppError(403, "Not authorized to pay for this request");
    if (connectRequest.status !== "accepted")
      throw new AppError(400, `Payment only allowed on accepted requests. Current status: ${connectRequest.status}`);
    if (connectRequest.paymentStatus === "paid")
      throw new AppError(409, "Payment already made for this session");

    const menteeWallet = await repo.findWalletByUser(menteeId, session);

    if (!menteeWallet) throw new AppError(404, "Mentee wallet not found");
    if (menteeWallet.balance < totalAmount)
      throw new AppError(400, `Insufficient balance. You have ${menteeWallet.balance} tokens but need ${totalAmount}`);

    menteeWallet.balance -= totalAmount;
    menteeWallet.escrow += totalAmount;
    await repo.saveWallet(menteeWallet, session);

    Object.assign(connectRequest, {
      sessionRate, sessionCount, totalAmount, commissionRate,
      commissionAmount: platformFee, mentorPayout: mentorAmount,
      paymentStatus: "paid", status: "ongoing", paidAt: new Date(),
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

    logger.info("Escrow pay committed", {
      menteeId: menteeId.toString(),
      connectRequestId,
      mentorAmount,
      platformFee,
      commissionRate,
      totalAmount,
      balanceAfter: menteeWallet.balance,
    });

    dispatchPaySideEffects(connectRequest, { sessionRate, sessionCount, totalAmount, mentorAmount, commissionRate });

    return {
      mentorAmount, platformFee, totalAmount, commissionRate,
      balance: menteeWallet.balance,
      escrow: menteeWallet.escrow,
      paymentStatus: "paid",
      status: "ongoing",
    };

  } catch (err) {
    await session.abortTransaction();
    logger.error("Escrow pay failed — transaction aborted", { error: err.message, connectRequestId, menteeId: menteeId?.toString() });
    throw err;
  } finally {
    session.endSession();
  }
};

// RELEASE
const release = async ({ requestId, menteeId }) => {
  const admin = await requireAdmin();
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const connectRequest = await repo.findConnectRequestRaw(requestId, session);

    if (!connectRequest) throw new AppError(404, "Connect request not found");
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
    logger.info("Escrow release committed", {
      requestId,
      menteeId: menteeId.toString(),
      mentorId: mentorId.toString(),
      totalAmount,
      commissionAmount,
      commissionRate,
      mentorPayout,
    });

    return { totalAmount, commissionRate, commissionAmount, mentorPayout, menteeEscrow: menteeWallet.escrow, status: "completed" };
  } catch (err) {
    try { await session.abortTransaction(); } catch (abortErr) {
      logger.warn("abortTransaction failed during release", { error: abortErr.message });
    }
    logger.error("Escrow release failed", { error: err.message, requestId, menteeId: menteeId?.toString() });
    throw err;
  } finally {
    session.endSession();
  }
};

// REFUND
const refund = async ({ requestId, userId }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const connectRequest = await repo.findConnectRequestRaw(requestId, session);

    if (!connectRequest) throw new AppError(404, "Connect request not found");

    const isMentee = connectRequest.mentee.toString() === userId.toString();
    const isMentor = connectRequest.mentor.toString() === userId.toString();

    if (!isMentee && !isMentor) throw new AppError(403, "Not authorized to refund this session");
    if (connectRequest.paymentStatus !== "paid") throw new AppError(400, "No paid escrow found to refund");
    if (connectRequest.status === "completed") throw new AppError(400, "Cannot refund a completed session");

    const { totalAmount, mentee: menteeId } = connectRequest;
    const menteeWallet = await repo.findWalletByUser(menteeId, session);

    if (!menteeWallet) throw new AppError(404, "Mentee wallet not found");
    if (menteeWallet.escrow < totalAmount) throw new AppError(400, "Escrow balance mismatch. Contact support");

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

    logger.info("Escrow refund committed", {
      requestId,
      userId: userId.toString(),
      totalAmount,
      balanceAfter: menteeWallet.balance,
    });

    return { totalAmount, balance: menteeWallet.balance, escrow: menteeWallet.escrow, status: "rejected", paymentStatus: "refunded" };
  } catch (err) {
    await session.abortTransaction();
    logger.error("Escrow refund failed", { error: err.message, requestId, userId: userId?.toString() });
    throw err;
  } finally {
    session.endSession();
  }
};

// GET STATUS
const getStatus = async ({ requestId, userId }) => {
  const connectRequest = await repo.findConnectRequestByIdLean(requestId);

  if (!connectRequest) throw new AppError(404, "Connect request not found");

  const isMentee = connectRequest.mentee.toString() === userId.toString();
  const isMentor = connectRequest.mentor.toString() === userId.toString();

  if (!isMentee && !isMentor) throw new AppError(403, "Not authorized to view this session");

  const admin = await repo.findActiveAdmin();
  const commissionRate = admin?.commissionRate ?? DEFAULT_COMMISSION_RATE;
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
    wallet: menteeWallet ? { balance: menteeWallet.balance, escrow: menteeWallet.escrow } : null,
  };
};

// GET MY WALLET
const getMyWallet = async (userId) => {
  const wallet = await repo.findWalletByUserLean(userId);
  if (!wallet) throw new AppError(404, "Wallet not found");
  return { balance: wallet.balance, escrow: wallet.escrow };
};

// GET COMMISSION RATE
const getCommissionRate = async () => {
  const admin = await repo.findActiveAdmin();
  if (admin?.commissionRate == null) throw new AppError(404, "Commission rate not configured");
  return { commissionRate: admin.commissionRate };
};

// PAY ADDITIONAL
const payAdditional = async ({ connectRequestId, sessionRate, slotId, menteeId }) => {
  if (!connectRequestId || !sessionRate || !slotId)
    throw new AppError(422, "connectRequestId, sessionRate, and slotId are required");
  if (sessionRate < 1) throw new AppError(422, "sessionRate must be at least 1");
  const admin = await requireAdmin();
  const commissionRate = admin.commissionRate ?? DEFAULT_COMMISSION_RATE;
  const platformFee = Math.ceil((sessionRate * commissionRate) / 100);
  const totalAmount = sessionRate + platformFee;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const connectRequest = await repo.findConnectRequestById(connectRequestId, session);

    if (!connectRequest) throw new AppError(404, "Connect request not found");
    if (connectRequest.mentee._id.toString() !== menteeId.toString()) throw new AppError(403, "Not authorized");
    if (connectRequest.status !== "ongoing") throw new AppError(400, "Additional payment only allowed on ongoing sessions");

    const additionalSlot = connectRequest.additionalSlots?.id(slotId);
    if (!additionalSlot) throw new AppError(404, "Additional slot not found");
    if (additionalSlot.paymentStatus === "paid") throw new AppError(409, "This slot has already been paid for");

    const menteeWallet = await repo.findWalletByUser(menteeId, session);

    if (!menteeWallet) throw new AppError(404, "Mentee wallet not found");
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

    logger.info("Additional escrow payment committed", {
      menteeId: menteeId.toString(),
      connectRequestId,
      slotId,
      sessionRate,
      platformFee,
      commissionRate,
      totalAmount,
      balanceAfter: menteeWallet.balance,
    });

    return { sessionRate, platformFee, totalAmount, commissionRate, balance: menteeWallet.balance, escrow: menteeWallet.escrow, slotId };
  } catch (err) {
    await session.abortTransaction();
    logger.error("Additional escrow payment failed", { error: err.message, connectRequestId, slotId, menteeId: menteeId?.toString() });
    throw err;
  } finally {
    session.endSession();
  }
};

  return { pay, payAdditional, release, refund, getStatus, getMyWallet, getCommissionRate };
};
module.exports = createEscrowService;