// controllers/mentorSearch.controller.js
const MentorProfile = require("../models/MentorProfile");
const User = require("../models/User");

// ✅ Add indexes for performance — runs once on server start
MentorProfile.collection.createIndex({ skills: 1 });
MentorProfile.collection.createIndex({ industry: 1 });
MentorProfile.collection.createIndex({ hourlyRate: 1 });
MentorProfile.collection.createIndex({ avgRating: -1 });
MentorProfile.collection.createIndex({ isProfilePublished: 1, isProfileComplete: 1 });

/**
 * GET /api/mentors/search
 * Query params:
 *   skill      — letter-by-letter regex match on skills array e.g. "r" → react, rails, ruby
 *   name       — regex match on mentor's name e.g. "john" → John Mentor
 *   industry   — exact match e.g. "Technology"
 *   minPrice   — hourlyRate >= minPrice
 *   maxPrice   — hourlyRate <= maxPrice
 *   minRating  — avgRating >= minRating
 *   page       — pagination page number (default: 1)
 *   limit      — results per page (default: 6)
 */
const searchMentors = async (req, res) => {
  try {
    const {
      skill = "",
      name = "",
      industry = "",
      minPrice,
      maxPrice,
      minRating,
      page = 1,
      limit = 6,
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(20, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    // ── Base filter: only published + complete profiles ──────
    const filter = {
      isProfilePublished: true,
      isProfileComplete: true,
    };

    // ── Name + Skill search — uses $or so either match works ─
    // User types "John"  → finds mentors named John
    // User types "React" → finds mentors with React skill
    // User types "John"  → also checks if any skill matches "John" (safe fallback)
    if (name.trim() || skill.trim()) {
      const orConditions = [];

      // Name search — find User docs matching name, then match their profiles
      if (name.trim()) {
        const matchingUsers = await User.find({
          name:  { $regex: name.trim(), $options: "i" },
          roles: { $in: ["mentor"] },
        }).select("_id").lean();

        const userIds = matchingUsers.map((u) => u._id);

        if (userIds.length > 0) {
          orConditions.push({ user: { $in: userIds } });
        }
      }

      // Skill search — letter-by-letter regex on skills array
      if (skill.trim()) {
        orConditions.push({
          skills: {
            $elemMatch: {
              $regex: skill.trim(),
              $options: "i",
            },
          },
        });
      }

      // Only apply $or if we have conditions — avoids empty $or crash
      if (orConditions.length > 0) {
        filter.$or = orConditions;
      }
    }

    // ── Industry filter (optional) ───────────────────────────
    if (industry.trim()) {
      filter.industry = { $regex: industry.trim(), $options: "i" };
    }

    // ── Price range filter (optional) ────────────────────────
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.hourlyRate = {};
      if (minPrice !== undefined) filter.hourlyRate.$gte = Number(minPrice);
      if (maxPrice !== undefined) filter.hourlyRate.$lte = Number(maxPrice);
    }

    // ── Rating filter (optional) ─────────────────────────────
    if (minRating !== undefined) {
      filter.avgRating = { $gte: Number(minRating) };
    }

    // ── Run count + paginated query in parallel ──────────────
    const [totalCount, mentors] = await Promise.all([
      MentorProfile.countDocuments(filter),
      MentorProfile.find(filter)
        .populate("user", "name email")
        .select(
          "user currentRole industry company skills hourlyRate avgRating profilePicture linkedInUrl portfolioUrl"
        )
        .sort({ avgRating: -1, hourlyRate: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);
    const hasMore    = pageNum < totalPages;

    return res.status(200).json({
      success: true,
      mentors,
      pagination: {
        totalCount,
        totalPages,
        currentPage: pageNum,
        hasMore,
      },
    });

  } catch (err) {
    console.error("❌ Mentor search error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error while searching mentors",
    });
  }
};

module.exports = { searchMentors };