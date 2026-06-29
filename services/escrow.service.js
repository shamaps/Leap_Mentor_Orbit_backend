// backend/services/escrow.service.js
const AppError = require("../utils/appError");
const sendInvoiceEmail = require("../utils/sendInvoiceEmail");
const { withTransaction } = require("../utils/withTransaction");
const { toPayDTO, toReleaseDTO, toRefundDTO, toEscrowStatusDTO, toWalletDTO } = require("../utils/mappers/escrow.mapper");
const { sendCalendarInvite } = require("../utils/sendCalendarInvite");
const { sendPaymentReceivedEmail } = require("../utils/emails");
const { DEFAULT_COMMISSION_RATE, PLATFORM_TIMEZONE } = require("../config/constants");

/**
 * @typedef {Object} AdditionalSlot
 * @property {string} _id - Unique subdocument item key identifier.
 * @property {string} paymentStatus - Status string tracking state ("pending" | "paid").
 * @property {Date} [paidAt] - Timestamp recording financial confirmation.
 * @property {number} [sessionRate] - The calculated pricing rate.
 * @property {number} [totalAmount] - The combined cost value including platform markups.
 */

/**
 * @typedef {Object} EscrowRepository
 * @property {() => Promise<Object|null>} findActiveAdmin - Fetches platform administration tracking configs.
 * @property {(adminId: any, amount: number, session?: any) => Promise<Object|null>} creditAdmin - Routes platform fees.
 * @property {(id: string, session?: any) => Promise<Object|null>} findConnectRequestById - Resolves full populated relationship rows.
 * @property {(id: string) => Promise<Object|null>} findConnectRequestByIdLean - Fast read-only query for snapshot details.
 * @property {(id: string, session?: any) => Promise<Object|null>} findConnectRequestRaw - Resolves unpopulated operational structures.
 * @property {(request: Object, session?: any) => Promise<Object>} saveConnectRequest - Persists connection record modifications.
 * @property {(userId: any, session?: any) => Promise<Object|null>} findWalletByUser - Selects active ledger accounts for mutations.
 * @property {(userId: any) => Promise<Object|null>} findWalletByUserLean - Resolves balance variables cleanly.
 * @property {(wallet: Object, session?: any) => Promise<Object>} saveWallet - Persists structural balance shifts back to database.
 * @property {(docs: Object[], session?: any) => Promise<Object[]>} createTransactions - Bulk writes audit trail items.
 * @property {(mentorId: any) => Promise<Object|null>} findMentorTimezone - Resolves mentor-specific availability headers.
 * @property {(mentorId: any, session?: any) => Promise<Object|null>} incrementMentorSessions - Advances velocity tracking.
 */

/**
 * Factory function implementing the core Escrow transactional layer orchestration logic.
 * * @param {EscrowRepository} repo - Database transaction repository persistence layer.
 * @param {{ logger: Object }} dependencies - System telemetry monitoring interface parameters.
 * @returns {Object} Bundled service actions map configuration.
 */
const createEscrowService = (repo, { logger }) => {

  /**
   * Evaluates platform integrity metrics ensuring administration entity targets exist.
   * * @async
   * @private
   * @function requireAdmin
   * @throws {AppError} 500 - If active administrator parameters are uninitialized on database.
   * @returns {Promise<Object>} Active administrative configuration record layout.
   */
  const requireAdmin = async () => {
    const admin = await repo.findActiveAdmin();
    if (!admin) throw new AppError(500, "Platform admin not found. Contact support.");
    return admin;
  };

  /**
   * Distributes best-effort informational invoices, payment alerts, and calendar notifications.
   * * @private
   * @function dispatchPaySideEffects
   * @param {Object} connectRequest - The active interactive transaction parent document model.
   * @param {Object} pricing - Numeric calculation matrix elements tracking balances.
   * @param {number} pricing.sessionRate - Base rate per appointment window.
   * @param {number} pricing.sessionCount - Total volume count requested.
   * @param {number} pricing.totalAmount - Aggregated cost ceiling values.
   * @param {number} pricing.mentorAmount - Net share scheduled for provider.
   * @param {number} pricing.commissionRate - Platform cut percentage metric value.
   */
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

  /**
   * Deducts tokens from a mentee's available balance and transfers them into an escrow hold within an ACID-compliant transaction.
   * * @async
   * @function pay
   * @param {Object} parameters - Intake processing credentials payload.
   * @param {string} parameters.connectRequestId - Unique system tracking row index key string.
   * @param {any} parameters.menteeId - Performing consumer account user index identifier.
   * @param {number} parameters.sessionRate - Cost value per single meeting window.
   * @param {number} parameters.sessionCount - Total volume count requested.
   * @throws {AppError} 400 - If request state is not "accepted" or available liquidity is insufficient.
   * @throws {AppError} 403 - If processing actor credentials fail relationship ownership check constraints.
   * @throws {AppError} 404 - If the structural connection record or specific wallet document is missing.
   * @throws {AppError} 409 - If payment status flags denote tracking items already processed.
   * @returns {Promise<Object>} Formatted payment DTO showing asset hold confirmations.
   */
  const pay = async ({ connectRequestId, menteeId, sessionRate, sessionCount }) => {
    const mentorAmount = sessionRate * sessionCount;
    const admin = await repo.findActiveAdmin();
    const commissionRate = admin?.commissionRate ?? DEFAULT_COMMISSION_RATE;
    const platformFee = Math.ceil((mentorAmount * commissionRate) / 100);
    const totalAmount = mentorAmount + platformFee;

    const result = await withTransaction(async (session) => {
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
        user: menteeId, type: "escrow_hold", amount: totalAmount,
        connectRequest: connectRequest._id,
        description: `Escrow hold — ${sessionCount} session(s) × ${sessionRate} tokens + ${commissionRate}% platform fee`,
        balanceAfter: menteeWallet.balance,
      }], session);

      return { connectRequest, menteeWallet, mentorAmount, platformFee, totalAmount, commissionRate };
    }, "escrow.pay");

    dispatchPaySideEffects(result.connectRequest, {
      sessionRate, sessionCount,
      totalAmount: result.totalAmount,
      mentorAmount: result.mentorAmount,
      commissionRate: result.commissionRate,
    });

    return toPayDTO({
      mentorAmount: result.mentorAmount,
      platformFee: result.platformFee,
      totalAmount: result.totalAmount,
      commissionRate: result.commissionRate,
      balance: result.menteeWallet.balance,
      escrow: result.menteeWallet.escrow,
      paymentStatus: "paid",
      status: "ongoing",
    });
  };

  /**
   * Releases escrowed funds, transferring the mentor's net payout to their wallet balance and the platform cut to the admin account.
   * * @async
   * @function release
   * @param {Object} payload - Interactive criteria parameters block.
   * @param {string} payload.requestId - Targeted interaction row tracking key string.
   * @param {any} payload.menteeId - Security verify validation signature tracking ownership.
   * @throws {AppError} 400 - If interaction statuses are not "ongoing" or no active payment tracking exists.
   * @throws {AppError} 403 - If user contexts are not identical to record configuration parameters.
   * @throws {AppError} 404 - If structural data rows or wallet entries yield unresolvable items.
   * @returns {Promise<Object>} Formatted completion metadata DTO layout results.
   */
  const release = async ({ requestId, menteeId }) => {
    const admin = await requireAdmin();

    return await withTransaction(async (session) => {
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
      await repo.creditAdmin(admin._id, commissionAmount, session);

      connectRequest.status = "completed";
      connectRequest.completedAt = new Date();
      await repo.saveConnectRequest(connectRequest, session);
      await repo.incrementMentorSessions(mentorId, session);
      await repo.createTransactions([
        {
          user: menteeId, type: "escrow_release", amount: totalAmount,
          connectRequest: connectRequest._id,
          description: "Escrow released on session completion",
          balanceAfter: menteeWallet.escrow,
        },
        {
          user: mentorId, type: "commission_deduct", amount: commissionAmount,
          connectRequest: connectRequest._id,
          description: `Platform fee (${commissionRate}%) collected`,
          balanceAfter: mentorWallet.balance,
        },
        {
          user: mentorId, type: "mentor_payout", amount: mentorPayout,
          connectRequest: connectRequest._id,
          description: "Session payout — full rate received",
          balanceAfter: mentorWallet.balance,
        },
      ], session);

      return toReleaseDTO({ totalAmount, commissionRate, commissionAmount, mentorPayout, menteeEscrow: menteeWallet.escrow, status: "completed" });
    }, "escrow.release");
  };

  /**
   * Reverts escrowed assets back to a mentee's active liquid balance following an appointment cancellation.
   * * @async
   * @function refund
   * @param {Object} context - Payload identification container.
   * @param {string} context.requestId - Targeted unique identity tracking row key.
   * @param {any} context.userId - Active performing entity token identifier key.
   * @throws {AppError} 400 - If historical tracking lines reflect finished items or payment status is unpaid.
   * @throws {AppError} 403 - If caller identities aren't present inside the target model fields.
   * @throws {AppError} 404 - If connection document items or wallet records fail lookup queries.
   * @returns {Promise<Object>} Formatted cancelation summary DTO payload.
   */
  const refund = async ({ requestId, userId }) => {
    return await withTransaction(async (session) => {
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
        user: menteeId, type: "escrow_refund", amount: totalAmount,
        connectRequest: connectRequest._id,
        description: "Full refund — session cancelled (incl. platform fee)",
        balanceAfter: menteeWallet.balance,
      }], session);

      return toRefundDTO({ totalAmount, balance: menteeWallet.balance, escrow: menteeWallet.escrow, status: "rejected", paymentStatus: "refunded" });
    }, "escrow.refund");
  };

  /**
   * Collects financial performance details and payment tracking properties relative to a specific appointment ID.
   * * @async
   * @function getStatus
   * @param {Object} queries - Target query identification arguments.
   * @param {string} queries.requestId - Primary lookup criteria matching structural tracking entries.
   * @param {any} queries.userId - Context verification token identity index.
   * @throws {AppError} 403 - If request properties show a mismatch against user authentication indices.
   * @throws {AppError} 404 - If tracking connections fail database entry resolution.
   * @returns {Promise<Object>} Mapped structural data tracking escrow metrics variables.
   */
  const getStatus = async ({ requestId, userId }) => {
    const connectRequest = await repo.findConnectRequestByIdLean(requestId);

    if (!connectRequest) throw new AppError(404, "Connect request not found");

    const isMentee = connectRequest.mentee.toString() === userId.toString();
    const isMentor = connectRequest.mentor.toString() === userId.toString();

    if (!isMentee && !isMentor) throw new AppError(403, "Not authorized to view this session");

    const admin = await repo.findActiveAdmin();
    const commissionRate = admin?.commissionRate ?? DEFAULT_COMMISSION_RATE;
    const menteeWallet = await repo.findWalletByUserLean(connectRequest.mentee);

    return toEscrowStatusDTO({ status: connectRequest.status, paymentStatus: connectRequest.paymentStatus, sessionRate: connectRequest.sessionRate, sessionCount: connectRequest.sessionCount, totalAmount: connectRequest.totalAmount, paidAt: connectRequest.paidAt, completedAt: connectRequest.completedAt, confirmedSlot: connectRequest.confirmedSlot, commissionRate, wallet: menteeWallet ? { balance: menteeWallet.balance, escrow: menteeWallet.escrow } : null });
  };

  /**
   * Resolves basic balance allocations and holding profiles for a specified secure account index.
   * * @async
   * @function getMyWallet
   * @param {any} userId - Inbound user payload index locator key string.
   * @throws {AppError} 404 - If account wallet structural record is missing.
   * @returns {Promise<Object>} Formatted mapping containing available and locked balances.
   */
  const getMyWallet = async (userId) => {
    const wallet = await repo.findWalletByUserLean(userId);
    if (!wallet) throw new AppError(404, "Wallet not found");
    return toWalletDTO({ balance: wallet.balance, escrow: wallet.escrow });
  };

  /**
   * Reads the current system-wide baseline platform percentage configuration.
   * * @async
   * @function getCommissionRate
   * @throws {AppError} 404 - If baseline admin tracking properties are uninitialized.
   * @returns {Promise<{commissionRate: number}>} Current percentage rate value mapping.
   */
  const getCommissionRate = async () => {
    const admin = await repo.findActiveAdmin();
    if (admin?.commissionRate == null) throw new AppError(404, "Commission rate not configured");
    return { commissionRate: admin.commissionRate };
  };

  /**
   * Segregates assets specific to single dynamic custom milestones outside initial scheduling pipelines.
   * * @async
   * @function payAdditional
   * @param {Object} input - Execution context attributes parameter elements.
   * @param {string} input.connectRequestId - Unique tracker entity row pointer.
   * @param {number} input.sessionRate - Targeted asset cost boundary indicator.
   * @param {string} input.slotId - Specific inner subdocument array key locator.
   * @param {any} input.menteeId - Security verify criteria validating transaction rights.
   * @throws {AppError} 400 - If active item properties show a status other than ongoing.
   * @throws {AppError} 403 - If user index criteria fail safety verification check bounds.
   * @throws {AppError} 404 - If transaction items, sub-components, or user wallets fail queries.
   * @throws {AppError} 409 - If targeted internal sub-items already maintain completed paid flags.
   * @throws {AppError} 422 - If arguments exhibit formatting errors or pricing parameters drop below floor limits.
   * @returns {Promise<Object>} Result map displaying mutation details confirming additional locks.
   */
  const payAdditional = async ({ connectRequestId, sessionRate, slotId, menteeId }) => {
    if (!connectRequestId || !sessionRate || !slotId)
      throw new AppError(422, "connectRequestId, sessionRate, and slotId are required");
    if (sessionRate < 1) throw new AppError(422, "sessionRate must be at least 1");

    const admin = await requireAdmin();
    const commissionRate = admin.commissionRate ?? DEFAULT_COMMISSION_RATE;
    const platformFee = Math.ceil((sessionRate * commissionRate) / 100);
    const totalAmount = sessionRate + platformFee;

    return await withTransaction(async (session) => {
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
        user: menteeId, type: "escrow_hold", amount: totalAmount,
        connectRequest: connectRequest._id,
        description: `Escrow hold — additional session × ${sessionRate} tokens + ${commissionRate}% platform fee`,
        balanceAfter: menteeWallet.balance,
      }], session);
      return { sessionRate, platformFee, totalAmount, commissionRate, balance: menteeWallet.balance, escrow: menteeWallet.escrow, slotId };
    }, "escrow.payAdditional");
  };

  return { pay, release, refund, getStatus, getMyWallet, getCommissionRate, payAdditional };
};

module.exports = createEscrowService;