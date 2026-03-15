// backend/scripts/seedAdmin.js
// ── Run once to create the first admin ───────────────────────
// Usage: node backend/scripts/seedAdmin.js

require("dotenv").config();
const mongoose  = require("mongoose");
const AdminUser = require("../models/AdminUser");

const ADMIN = {
  name:         "Super Admin",
  email:        "leapmentor2026@gmail.com",   // ← change this
  password:     "leapAdminMentor",             // ← change this
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