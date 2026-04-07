// backend/controllers/mentorSearch.controller.js
const MentorProfile = require("../models/MentorProfile");
const User          = require("../models/User");

const searchMentors = async (req, res) => {
  try {
    const {
      skill = "", name = "",
      industry = "",
      minPrice, maxPrice, minRating,
      page = 1, limit = 6,
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(20, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    // Validate price range before doing anything
if (minPrice !== undefined && maxPrice !== undefined) {
  const min = Number(minPrice);
  const max = Number(maxPrice);
  if (!isNaN(min) && !isNaN(max) && min > max) {
    return res.status(200).json({
      success: true,
      mentors: [],
      pagination: { totalCount: 0, totalPages: 0, currentPage: pageNum, hasMore: false },
    });
  }
}

    const hasQuery   = skill.trim() || name.trim();
    const hasFilters = industry.trim() || minPrice !== undefined
                       || maxPrice !== undefined || minRating !== undefined;

    // ── No query + no filters — return all published mentors 
    if (!hasQuery && !hasFilters) {
      return await plainList(res, pageNum, limitNum, skip);
    }

    // ── Step 1: Name search — regex on User collection 
    let nameMatchedProfileUserIds = null; // null = not searched

    if (name.trim()) {
      const matchingUsers = await User.find({
        name:  { $regex: name.trim(), $options: "i" },
        roles: { $in: ["mentor"] },
      }).select("_id").lean();

      // Convert to string set for easy lookup later
      nameMatchedProfileUserIds = new Set(
        matchingUsers.map((u) => u._id.toString())
      );
    }

    // ── Step 2: Atlas Search for skill ────────────────────────
    const filterClauses = [
      { equals: { path: "isProfilePublished", value: true } },
      { equals: { path: "isProfileComplete",  value: true } },
    ];
    const mustClauses   = [];
    const shouldClauses = [];

    if (skill.trim()) {
      // autocomplete uses edgeGram — "no" matches "node" from 1 char
      shouldClauses.push({
        autocomplete: {
          query: skill.trim(),
          path:  "skills",
          fuzzy: { maxEdits: 1 },
          score: { boost: { value: 10 } },
        },
      });
      shouldClauses.push({
        autocomplete: {
          query: skill.trim(),
          path:  "currentRole",
          fuzzy: { maxEdits: 1 },
          score: { boost: { value: 5 } },
        },
      });
      // text search for industry/company (full word match)
      shouldClauses.push({
        text: {
          query: skill.trim(),
          path:  ["industry", "company"],
          fuzzy: { maxEdits: 1 },
          score: { boost: { value: 3 } },
        },
      });
    }

    if (industry.trim()) {
      mustClauses.push({
        text: {
          query: industry.trim(),
          path:  "industry",
          fuzzy: { maxEdits: 1 },
        },
      });
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      const r = { range: { path: "hourlyRate" } };
      if (minPrice !== undefined) r.range.gte = Number(minPrice);
      if (maxPrice !== undefined) r.range.lte = Number(maxPrice);
      filterClauses.push(r);
    }

    if (minRating !== undefined) {
      filterClauses.push({ range: { path: "avgRating", gte: Number(minRating) } });
    }

    const compound = { filter: filterClauses };
    if (mustClauses.length   > 0) compound.must   = mustClauses;
    if (shouldClauses.length > 0) compound.should  = shouldClauses;

    // ── Step 3: Run Atlas Search pipeline ────────────────────
    const pipeline = [
      { $search: { index: "mentor_search", compound } },
      { $addFields: { searchScore: { $meta: "searchScore" } } },
      {
        $lookup: {
          from: "users", localField: "user", foreignField: "_id", as: "userDoc",
        },
      },
      { $unwind: { path: "$userDoc", preserveNullAndEmptyArrays: false } },

      // ── Step 4: UNION filter ──────────────────────────────
      // Keep doc if:
      //   a) skill was searched AND score > 0 (skill match), OR
      //   b) name was searched AND this doc's user is in name matches
      {
        $match: (() => {
          const skillSearched = !!skill.trim();
          const nameSearched  = nameMatchedProfileUserIds !== null;

          if (skillSearched && nameSearched) {
            // Union: show if skill matched (score > 0) OR name matched
            return {
              $or: [
                { searchScore: { $gt: 0 } },
                // name match handled in JS post-filter below
              ],
            };
          }
          if (skillSearched) {
            // Only skill — must have relevance score
            return { searchScore: { $gt: 0 } };
          }
          // Only name or only filters — no score restriction
          return {};
        })(),
      },

      {
        $facet: {
          results: [
            { $sort: { searchScore: -1, avgRating: -1 } },
            { $skip: 0 }, // get all then filter in JS for union
            { $limit: 200 }, // cap at 200 for safety
           {
  $project: {
    _id:                1,
    currentRole:        1,
    industry:           1,
    company:            1,
    skills:             1,
    hourlyRate:         1,
    avgRating:          1,
    profilePicture:     1,
    linkedInUrl:        1,
    portfolioUrl:       1,
    searchScore:        1,
    yearsOfExperience:  1,  
    bio:                1,  
    verificationStatus: 1,
    user: {
      _id:   "$userDoc._id",
      name:  "$userDoc.name",
      email: "$userDoc.email",
    },
  },
}
          ],
        },
      },
    ];

    const [facetResult] = await MentorProfile.aggregate(pipeline);
    let results = facetResult?.results || [];

    // ── Step 5: JS-level union for name matches ───────────────
    // Add name-matched profiles that Atlas Search may have missed
    if (nameMatchedProfileUserIds && nameMatchedProfileUserIds.size > 0) {
      const atlasResultUserIds = new Set(
        results.map((r) => r.user._id.toString())
      );

      // Find name-matched profiles NOT already in Atlas results
      const missingIds = [...nameMatchedProfileUserIds].filter(
        (id) => !atlasResultUserIds.has(id)
      );

      if (missingIds.length > 0) {
        const extraProfiles = await MentorProfile.find({
          user:               { $in: missingIds },
          isProfilePublished: true,
          isProfileComplete:  true,
        })
          .populate("user", "name email")
          .select("user currentRole industry company skills hourlyRate avgRating profilePicture linkedInUrl portfolioUrl yearsOfExperience bio verificationStatus")  // ✅
          .lean();

        // Give name matches a lower score than skill matches (score: boost 10)
        // so skill results always rank above name-only matches
        const withScore = extraProfiles.map((p) => ({
          ...p,
          searchScore: 2,
          user: { _id: p.user._id, name: p.user.name, email: p.user.email },
        }));

        results = [...withScore, ...results];
      }

      // If name was searched — also filter out results that don't
      // match name AND don't match skill
      if (!skill.trim()) {
        // Pure name search — only show name-matched profiles
        results = results.filter((r) =>
          nameMatchedProfileUserIds.has(r.user._id.toString())
        );
      }
    }

    // ── If no results at all — return empty cleanly ───────────
    if (results.length === 0) {
      return res.status(200).json({
        success: true,
        mentors: [],
        pagination: { totalCount: 0, totalPages: 0, currentPage: pageNum, hasMore: false },
      });
    }

    // ── Step 6: Paginate the union results ────────────────────
    const totalCount = results.length;
    const totalPages = Math.ceil(totalCount / limitNum);
    const paginated  = results.slice(skip, skip + limitNum);

    return res.status(200).json({
      success: true,
      mentors: paginated,
      pagination: {
        totalCount,
        totalPages,
        currentPage: pageNum,
        hasMore:     pageNum < totalPages,
      },
    });

  } catch (err) {
    console.error("❌ Mentor search error:", err.message);
    if (err.message?.includes("$search") || err.message?.includes("search index")) {
      console.warn("⚠️  Atlas Search unavailable — falling back to regex");
      return fallbackSearch(req, res);
    }
    return res.status(500).json({ success: false, message: "use proper price ranges(min - max)" });
  }
};

// ─────────────────────────────────────────────────────────────
// Helper — return all published mentors (no search)
// ─────────────────────────────────────────────────────────────
const plainList = async (res, pageNum, limitNum, skip) => {
  const filter = { isProfilePublished: true, isProfileComplete: true };
  const [totalCount, mentors] = await Promise.all([
    MentorProfile.countDocuments(filter),
    MentorProfile.find(filter)
      .populate("user", "name email")
      .select("user currentRole industry company skills hourlyRate avgRating profilePicture linkedInUrl portfolioUrl yearsOfExperience bio verificationStatus")
      .sort({ avgRating: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
  ]);
  const totalPages = Math.ceil(totalCount / limitNum);
  return res.status(200).json({
    success: true,
    mentors,
    pagination: { totalCount, totalPages, currentPage: pageNum, hasMore: pageNum < totalPages },
  });
};

// ─────────────────────────────────────────────────────────────
// GET /api/mentors/autocomplete
// ─────────────────────────────────────────────────────────────
const autocompleteMentors = async (req, res) => {
  try {
    const { q = "" } = req.query;
    if (!q.trim()) return res.json({ success: true, suggestions: [] });

    // ── Skill/role autocomplete via Atlas ─────────────────────
    const pipeline = [
      {
        $search: {
          index: "mentor_autocomplete",
          compound: {
            must: [
              { equals: { path: "isProfilePublished", value: true } },
              { equals: { path: "isProfileComplete",  value: true } },
            ],
            should: [
              { autocomplete: { query: q.trim(), path: "skills",      fuzzy: { maxEdits: 1 } } },
              { autocomplete: { query: q.trim(), path: "currentRole", fuzzy: { maxEdits: 1 } } },
            ],
          },
        },
      },
      { $limit: 8 },
      { $project: { skills: 1, currentRole: 1, _id: 0 } },
    ];

    const [profileResults, nameResults] = await Promise.all([
      MentorProfile.aggregate(pipeline),
      // Also suggest mentor names
      User.find({
        name:  { $regex: q.trim(), $options: "i" },
        roles: { $in: ["mentor"] },
      }).select("name").limit(3).lean(),
    ]);

    const skillSet = new Set();
    const roleSet  = new Set();
    const nameSet  = new Set();

    profileResults.forEach((r) => {
      r.skills?.forEach((s) => {
        if (s.toLowerCase().includes(q.toLowerCase())) skillSet.add(s);
      });
      if (r.currentRole?.toLowerCase().includes(q.toLowerCase())) roleSet.add(r.currentRole);
    });

    nameResults.forEach((u) => nameSet.add(u.name));

    return res.json({
      success: true,
      suggestions: [
        ...[...skillSet].slice(0, 4).map((s) => ({ type: "skill", label: s })),
        ...[...roleSet].slice(0, 2).map((r)  => ({ type: "role",  label: r })),
        ...[...nameSet].slice(0, 3).map((n)  => ({ type: "name",  label: n })),
      ],
    });
  } catch (err) {
    console.error("❌ Autocomplete error:", err.message);
    return res.json({ success: true, suggestions: [] });
  }
};

// ─────────────────────────────────────────────────────────────
// Fallback — regex if Atlas unavailable
// ─────────────────────────────────────────────────────────────
const fallbackSearch = async (req, res) => {
  try {
    const {
      skill = "", name = "", industry = "",
      minPrice, maxPrice, minRating,
      page = 1, limit = 6,
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(20, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;
    const query    = skill.trim() || name.trim();

    const filter = { isProfilePublished: true, isProfileComplete: true };

    if (query) {
      const matchingUsers = await User.find({
        name:  { $regex: query, $options: "i" },
        roles: { $in: ["mentor"] },
      }).select("_id").lean();

      const orConditions = [];
      if (matchingUsers.length > 0) {
        orConditions.push({ user: { $in: matchingUsers.map((u) => u._id) } });
      }
      orConditions.push({ skills: { $elemMatch: { $regex: query, $options: "i" } } });
      filter.$or = orConditions;
    }

    if (industry.trim()) filter.industry = { $regex: industry.trim(), $options: "i" };
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.hourlyRate = {};
      if (minPrice !== undefined) filter.hourlyRate.$gte = Number(minPrice);
      if (maxPrice !== undefined) filter.hourlyRate.$lte = Number(maxPrice);
    }
    if (minRating !== undefined) filter.avgRating = { $gte: Number(minRating) };

    const [totalCount, mentors] = await Promise.all([
      MentorProfile.countDocuments(filter),
      MentorProfile.find(filter)
        .populate("user", "name email")
        .select("user currentRole industry company skills hourlyRate avgRating profilePicture linkedInUrl portfolioUrl yearsOfExperience bio verificationStatus")
        .sort({ avgRating: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      mentors,
      pagination: {
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
        currentPage: pageNum,
        hasMore: pageNum < Math.ceil(totalCount / limitNum),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { searchMentors, autocompleteMentors };