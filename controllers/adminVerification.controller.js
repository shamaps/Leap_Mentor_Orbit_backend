// controllers/adminVerification.controller.js
const MentorProfile = require("../models/MentorProfile.js");
const User = require("../models/User.js");

// ─────────────────────────────────────────────────────────
// GET /api/admin/mentor-verifications
// Returns all mentors with their user info + mentorProfile
// ─────────────────────────────────────────────────────────
const getAllMentorVerifications = async (req, res) => {
  try {
    const mentorProfiles = await MentorProfile.find({})
      .populate("user", "name email createdAt")
      .select(
        "user verificationStatus phoneNumber resumeDocument workExperienceDocuments " +
        "profilePicture bio skills currentRole company industry yearsOfExperience " +
        "languages averageRating totalSessions points"
      )
      .sort({ createdAt: -1 })
      .lean();

    const mentors = mentorProfiles.map((profile) => ({
      user: profile.user,
      mentorProfile: {
        ...profile,
        user: undefined, // avoid duplication
      },
    }));

    return res.status(200).json({ mentors, total: mentors.length });
  } catch (err) {
    console.error("[adminVerification] getAllMentorVerifications:", err);
    return res.status(500).json({ message: "Failed to fetch mentor verifications" });
  }
};

// ─────────────────────────────────────────────────────────
// GET /api/admin/mentor-verifications/:mentorProfileId
// Returns a single mentor's full profile + docs
// ─────────────────────────────────────────────────────────
const getMentorVerificationById = async (req, res) => {
  try {
    const { mentorProfileId } = req.params;

    const profile = await MentorProfile.findById(mentorProfileId)
      .populate("user", "name email createdAt")
      .lean();

    if (!profile) {
      return res.status(404).json({ message: "Mentor profile not found" });
    }

    return res.status(200).json({
      user: profile.user,
      mentorProfile: { ...profile, user: undefined },
    });
  } catch (err) {
    console.error("[adminVerification] getMentorVerificationById:", err);
    return res.status(500).json({ message: "Failed to fetch mentor profile" });
  }
};

// ─────────────────────────────────────────────────────────
// PATCH /api/admin/mentor-verifications/:mentorProfileId/verify
// Marks a mentor as verified
// ─────────────────────────────────────────────────────────
const verifyMentor = async (req, res) => {
  try {
    const { mentorProfileId } = req.params;

    const profile = await MentorProfile.findById(mentorProfileId).populate(
      "user",
      "name email"
    );

    if (!profile) {
      return res.status(404).json({ message: "Mentor profile not found" });
    }

    if (profile.verificationStatus === "verified") {
      return res.status(400).json({ message: "Mentor is already verified" });
    }

    profile.verificationStatus = "verified";
    await profile.save();

    return res.status(200).json({
      message: `${profile.user?.name || "Mentor"} has been verified successfully`,
      mentorProfileId: profile._id,
      verificationStatus: profile.verificationStatus,
    });
  } catch (err) {
    console.error("[adminVerification] verifyMentor:", err);
    return res.status(500).json({ message: "Failed to verify mentor" });
  }
};

// ─────────────────────────────────────────────────────────
// PATCH /api/admin/mentor-verifications/:mentorProfileId/revoke
// Revokes verification (back to unverified)
// ─────────────────────────────────────────────────────────
const revokeMentorVerification = async (req, res) => {
  try {
    const { mentorProfileId } = req.params;

    const profile = await MentorProfile.findById(mentorProfileId).populate(
      "user",
      "name email"
    );

    if (!profile) {
      return res.status(404).json({ message: "Mentor profile not found" });
    }

    if (profile.verificationStatus === "unverified") {
      return res.status(400).json({ message: "Mentor is already unverified" });
    }

    profile.verificationStatus = "unverified";
    await profile.save();

    return res.status(200).json({
      message: `Verification revoked for ${profile.user?.name || "mentor"}`,
      mentorProfileId: profile._id,
      verificationStatus: profile.verificationStatus,
    });
  } catch (err) {
    console.error("[adminVerification] revokeMentorVerification:", err);
    return res.status(500).json({ message: "Failed to revoke verification" });
  }
};

module.exports = {
  getAllMentorVerifications,
  getMentorVerificationById,
  verifyMentor,
  revokeMentorVerification,
};