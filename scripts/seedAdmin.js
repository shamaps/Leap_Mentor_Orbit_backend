// backend/scripts/seedAdmin.js
// ── Run once to create the first admin ───────────────────────
// Usage: node backend/scripts/seedAdmin.js

require("dotenv").config();
const mongoose  = require("mongoose");
const AdminUser = require("../models/AdminUser");

const { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME = "Super Admin" } = process.env;

if (!SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
  console.error("❌ SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env");
  process.exit(1);
}

const ADMIN = {
  name: SEED_ADMIN_NAME,
  email: SEED_ADMIN_EMAIL,
  password: SEED_ADMIN_PASSWORD,
  isSuperAdmin: true,
};

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    const exists = await AdminUser.findOne({ email: ADMIN.email });
    if (exists) {
      console.log("⚠️  Admin already exists:", ADMIN.email);
      process.exit(0);
    }

    await AdminUser.create(ADMIN);
    console.log("✅ Admin created:", ADMIN.email);
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed error:", err.message);
    process.exit(1);
  }
})();