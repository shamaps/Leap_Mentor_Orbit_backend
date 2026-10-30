const Escrow = require("@leapmentor/shared/models/Escrow");
const Wallet = require("@leapmentor/shared/models/Wallet");
const Transaction = require("@leapmentor/shared/models/Transaction");
const AdminUser = require("@leapmentor/shared/models/AdminUser");
const WalletOperation = require("@leapmentor/shared/models/WalletOperation");
const { getOrCreateWallet } = require("../utils/wallet");
const PlatformWallet = require("@leapmentor/shared/models/PlatformWallet");

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
    const query = AdminUser.findOne({ isActive: true }).select("commissionRate");

    return session ? query.session(session) : query;
  }, 
  creditPlatformWallet: (amount, session) => PlatformWallet.findOneAndUpdate(
    { key: PlatformWallet.PLATFORM_KEY },
    { $inc: { balance: amount } },
    { returnDocument: "after", upsert: true, session }
  ),

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
    { user: userId }, { $inc: { balance: amount } }, { returnDocument: "after", upsert: true, session }
  ),
 
};
