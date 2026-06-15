// models/RefreshToken.js
const mongoose = require("mongoose");

const refreshTokenSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    tokenHash: {       
        type: String,
        required: true,
        unique: true,
    },
    expiresAt: {
        type: Date,
        required: true,
    },
}, { timestamps: true });

// Auto-delete expired tokens from MongoDB
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.set("toJSON", {
    transform: (doc, ret) => {
        delete ret.tokenHash;
        delete ret.__v;
        return ret;
    }
});
module.exports = mongoose.model("RefreshToken", refreshTokenSchema);