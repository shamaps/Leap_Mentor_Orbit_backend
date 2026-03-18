// backend/scripts/seedPlatformCommission.js
// ── Run once to set commissionRate on existing admin ──────────
// Usage: node backend/scripts/seedPlatformCommission.js

require("dotenv").config({ path: __dirname + "/../.env" });
const mongoose  = require("mongoose");
const AdminUser = require("../models/AdminUser");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    const admin = await AdminUser.findOne({ isActive: true });
    if (!admin) {
      console.log("❌ No active admin found. Run seedAdmin.js first.");
      process.exit(1);
    }

    // Only update if fields don't exist yet
    let updated = false;

    if (admin.commissionRate === undefined || admin.commissionRate === null) {
      admin.commissionRate = 20;
      updated = true;
    }
    if (admin.walletBalance === undefined || admin.walletBalance === null) {
      admin.walletBalance = 0;
      updated = true;
    }

    if (updated) {
      // bypass password hash pre-save hook — only updating non-password fields
      await AdminUser.updateOne(
        { _id: admin._id },
        { $set: { commissionRate: 20, walletBalance: 0 } }
      );
      console.log(`✅ Admin "${admin.email}" updated — commissionRate: 20%, walletBalance: 0`);
    } else {
      console.log(`ℹ️  Admin "${admin.email}" already has commissionRate: ${admin.commissionRate}% — no changes made.`);
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Seed error:", err.message);
    process.exit(1);
  }
})();