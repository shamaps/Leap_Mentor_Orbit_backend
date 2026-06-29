module.exports = {
  async up(db) {
    // All mentor profiles created before verificationStatus was added
    // get set to "unverified" so the admin can review and approve them.
    await db.collection("mentorprofiles").updateMany(
      { verificationStatus: { $exists: false } },
      { $set: { verificationStatus: "unverified" } }
    );
    console.log("✅ Backfilled verificationStatus on existing mentor profiles");
  },

  async down(db) {
    // Only remove the field from docs that didn't have it before (unverified ones)
    await db.collection("mentorprofiles").updateMany(
      { verificationStatus: "unverified" },
      { $unset: { verificationStatus: "" } }
    );
  },
};