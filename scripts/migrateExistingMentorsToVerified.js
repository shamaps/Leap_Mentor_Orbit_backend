// scripts/migrateExistingMentorsToVerified.js
const mongoose = require("mongoose");
const MentorProfile = require("../models/MentorProfile");
require("dotenv").config();

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const result = await MentorProfile.updateMany(
      {
        verificationStatus: { $exists: false },
      },
      {
        $set: {
          verificationStatus:     "verified",
          phoneNumber:            "",
          resumeDocument:         null,
          workExperienceDocuments: [],
        },
      }
    );

    console.log(`✅ Migration complete — ${result.modifiedCount} mentor profiles marked as verified`);

  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

migrate();