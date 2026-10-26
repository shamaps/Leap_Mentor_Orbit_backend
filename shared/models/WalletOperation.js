const mongoose = require("mongoose");

const walletOperationSchema = new mongoose.Schema({
    idempotencyKey: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    result: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

module.exports = mongoose.models.WalletOperation || mongoose.model("WalletOperation", walletOperationSchema);
