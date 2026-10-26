const Escrow = require("@leapmentor/shared/models/Escrow");
const Wallet = require("@leapmentor/shared/models/Wallet");
const Transaction = require("@leapmentor/shared/models/Transaction");
const AdminUser = require("@leapmentor/shared/models/AdminUser");
const WalletOperation = require("@leapmentor/shared/models/WalletOperation");
const ConnectRequest = require("@leapmentor/shared/models/ConnectRequest");
const MentorProfile = require("@leapmentor/shared/models/MentorProfile");
const { getOrCreateWallet } = require("@leapmentor/shared/utils/wallet");

module.exports = {
  findEscrow: (requestId, session) => {
    const query = Escrow.findOne({ requestId });
    return session ? query.session(session) : query;
  },
  createEscrow: (data, session) => Escrow.create([data], { session }).then(([doc]) => doc),
  saveEscrow: (escrow, session) => escrow.save({ session }),
  findWallet: (userId, session) => getOrCreateWallet(userId, session),
  saveWallet: (wallet, session) => wallet.save({ session }),
  insertTransactions: (docs, session) => Transaction.insertMany(docs, { session, ordered: true }),
  findActiveAdmin: (session) => {
    const query = AdminUser.findOne({ isActive: true }).select("commissionRate walletBalance");
    return session ? query.session(session) : query;
  },
  creditAdmin: (adminId, amount, session) => AdminUser.findByIdAndUpdate(adminId, { $inc: { walletBalance: amount } }, { session }),
  findWalletOperation: (idempotencyKey, session) => {
    const query = WalletOperation.findOne({ idempotencyKey });
    return session ? query.session(session) : query;
  },
  createWalletOperation: (data, session) => WalletOperation.create([data], { session }).then(([doc]) => doc),
  findWalletBalance: async (userId) => {
    const wallet = await getOrCreateWallet(userId);
    return wallet ? { userId: String(userId), balance: wallet.balance, escrow: wallet.escrow } : null;
  },
  incrementWalletBalance: (userId, amount, session) => Wallet.findOneAndUpdate(
    { user: userId }, { $inc: { balance: amount } }, { new: true, upsert: true, session }
  ),
  syncRequestReleased: async (requestId, session) => {
    const result = await ConnectRequest.updateOne(
      { _id: requestId, status: { $ne: "completed" } },
      { $set: { status: "completed", completedAt: new Date() } },
      { session }
    );
    if (result.modifiedCount) {
      const request = await ConnectRequest.findById(requestId).select("mentor").session(session);
      if (!request) throw new Error("ConnectRequest disappeared while syncing Payments release");
      await MentorProfile.findOneAndUpdate({ user: request.mentor }, { $inc: { totalSessions: 1 } }, { session });
      return;
    }
    const request = await ConnectRequest.findById(requestId).select("status").session(session);
    if (!request) throw new Error("ConnectRequest not found while syncing Payments release");
  },
  syncRequestRefunded: (requestId) => ConnectRequest.updateOne(
    { _id: requestId }, { $set: { paymentStatus: "refunded" } }
  ),
};
