const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS } = require("@leapmentor/shared/utils/baseSchema");

const PLATFORM_KEY = "platform";

const platformWalletSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true, default: PLATFORM_KEY },
        balance: { type: Number, default: 0, min: 0 },
        openingBalance: { type: Number, default: 0 },
        migratedFromAdminAt: { type: Date, default: null },
    },
    BASE_SCHEMA_OPTIONS
);

const PlatformWallet = mongoose.models.PlatformWallet || mongoose.model("PlatformWallet", platformWalletSchema);

module.exports = PlatformWallet;
module.exports.PLATFORM_KEY = PLATFORM_KEY;
