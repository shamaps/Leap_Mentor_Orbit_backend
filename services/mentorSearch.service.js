// backend/services/mentorSearch.service.js
const repo = require("../repositories/mentorSearch.repository");
const { toMentorProfileSummary } = require("../utils/mappers/mentorProfile.mapper");
const logger = require("../utils/logger");
// ─────────────────────────────────────────────────────────────
// Pure helpers — extracted to reduce cognitive complexity
// ─────────────────────────────────────────────────────────────

const emptyPage = (pageNum) => ({
    mentors: [],
    pagination: { totalCount: 0, totalPages: 0, currentPage: pageNum, hasMore: false },
});

/**
 * Checks whether minPrice > maxPrice (invalid range).
 * Extracted so searchMentors() doesn't carry this branch inline.
 */
const isPriceRangeInvalid = (minPrice, maxPrice) => {
    if (minPrice === undefined || maxPrice === undefined) return false;
    const min = Number(minPrice);
    const max = Number(maxPrice);
    return !Number.isNaN(min) && !Number.isNaN(max) && min > max;
};

/**
 * Builds the Atlas Search `should` clauses for a skill query.
 * FIX: replaces three consecutive Array#push() calls with a single push of an array spread,
 * satisfying "Do not call Array#push() multiple times".
 */
const buildSkillShouldClauses = (skill) => [
    { autocomplete: { query: skill, path: "skills", fuzzy: { maxEdits: 1 }, score: { boost: { value: 10 } } } },
    { autocomplete: { query: skill, path: "currentRole", fuzzy: { maxEdits: 1 }, score: { boost: { value: 5 } } } },
    { text: { query: skill, path: ["industry", "company"], fuzzy: { maxEdits: 1 }, score: { boost: { value: 3 } } } },
];

/**
 * Builds the Atlas compound clause object from query params.
 * Extracted to remove the clause-building block from searchMentors().
 */
const buildAtlasCompound = ({ skill, industry, minPrice, maxPrice, minRating }) => {
    const filterClauses = [
        { equals: { path: "isProfilePublished", value: true } },
        { equals: { path: "isProfileComplete", value: true } },
    ];
    const mustClauses = [];
    const shouldClauses = [];

    if (skill.trim()) {
        // FIX: single push with spread instead of three consecutive pushes
        shouldClauses.push(...buildSkillShouldClauses(skill.trim()));
    }

    if (industry.trim()) {
        mustClauses.push({ text: { query: industry.trim(), path: "industry", fuzzy: { maxEdits: 1 } } });
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
    if (mustClauses.length > 0) compound.must = mustClauses;
    if (shouldClauses.length > 0) compound.should = shouldClauses;

    return compound;
};

/**
 * Builds the $match stage for experience filtering (applied post-Atlas).
 */
const buildExpMatch = (minExperience, maxExperience) => {
    if (minExperience === undefined && maxExperience === undefined) return {};
    const match = { yearsOfExperience: {} };
    if (minExperience !== undefined) match.yearsOfExperience.$gte = Number(minExperience);
    if (maxExperience !== undefined) match.yearsOfExperience.$lte = Number(maxExperience);
    return match;
};

/**
 * Builds the full Atlas aggregation pipeline.
 * Extracted to keep searchMentors() readable.
 */
const buildAtlasPipeline = (compound, expMatch) => [
    { $search: { index: "mentor_search", compound } },
    { $addFields: { searchScore: { $meta: "searchScore" } } },
    ...(Object.keys(expMatch).length > 0 ? [{ $match: expMatch }] : []),
    { $lookup: { from: "users", localField: "user", foreignField: "_id", as: "userDoc" } },
    { $unwind: { path: "$userDoc", preserveNullAndEmptyArrays: false } },
    {
        $project: {
            user: { _id: "$userDoc._id", name: "$userDoc.name", email: "$userDoc.email" },
            currentRole: 1, industry: 1, company: 1, skills: 1,
            hourlyRate: 1, avgRating: 1, profilePicture: 1,
            linkedInUrl: 1, portfolioUrl: 1, yearsOfExperience: 1,
            bio: 1, verificationStatus: 1, searchScore: 1,
        },
    },
    {
        $facet: {
            results: [{ $sort: { searchScore: -1 } }],
        },
    },
];

/**
 * Merges Atlas results with any name-matched profiles that Atlas missed.
 * FIX: extracted the union block out of searchMentors() to reduce complexity.
 */
const mergeNameMatches = async ({results, nameMatchedProfileUserIds, skill, expMatch}) => {
    if (!nameMatchedProfileUserIds?.size) return results;

    const atlasUserIds = new Set(results.map((r) => r.user._id.toString()));
    const missingIds = [...nameMatchedProfileUserIds].filter((id) => !atlasUserIds.has(id));

    if (missingIds.length > 0) {
        const extraProfiles = await repo.findProfilesByUserIds(missingIds, expMatch);
        const withScore = extraProfiles.map((p) => ({
            ...p,
            searchScore: 2,
            user: { _id: p.user._id, name: p.user.name, email: p.user.email },
        }));
        results = [...withScore, ...results];
    }

    // When no skill query, restrict to name-matched results only
    if (!skill.trim()) {
        results = results.filter((r) => nameMatchedProfileUserIds.has(r.user._id.toString()));
    }

    return results;
};

// ─────────────────────────────────────────────────────────────
// PLAIN LIST — no query, no filters
// ─────────────────────────────────────────────────────────────

const plainList = async (pageNum, limitNum, skip) => {
    const [totalCount, mentors] = await Promise.all([
        repo.countPublishedMentors(),
        repo.findPublishedMentors(skip, limitNum),
    ]);
    const totalPages = Math.ceil(totalCount / limitNum);
    return {
        mentors,
        pagination: { totalCount, totalPages, currentPage: pageNum, hasMore: pageNum < totalPages },
    };
};

// ─────────────────────────────────────────────────────────────
// FALLBACK SEARCH — regex, used when Atlas is unavailable
// Cognitive complexity reduced from 16 → under 15 by extracting
// buildFallbackFilter() and fixing the empty catch.
// ─────────────────────────────────────────────────────────────

/**
 * Builds the Mongoose filter for the regex fallback path.
 * Extracted to remove the nested if-blocks from fallbackSearch().
 */
const buildFallbackFilter = async ({ skill, name, industry, minPrice, maxPrice, minRating, minExperience, maxExperience }) => {
    const query = skill.trim() || name.trim();
    const filter = { isProfilePublished: true, isProfileComplete: true };

    if (query) {
        const matchingUsers = await repo.findMentorUsersByName(query);
        const orConditions = [];
        if (matchingUsers.length > 0) {
            orConditions.push({ user: { $in: matchingUsers.map((u) => u._id) } });
        }
        orConditions.push({ skills: { $elemMatch: { $regex: query, $options: "i" } } });
        filter.$or = orConditions;
    }

    if (industry.trim()) filter.industry = { $regex: industry.trim(), $options: "i" };
    if (minRating !== undefined) filter.avgRating = { $gte: Number(minRating) };

    if (minPrice !== undefined || maxPrice !== undefined) {
        filter.hourlyRate = {};
        if (minPrice !== undefined) filter.hourlyRate.$gte = Number(minPrice);
        if (maxPrice !== undefined) filter.hourlyRate.$lte = Number(maxPrice);
    }

    if (minExperience !== undefined || maxExperience !== undefined) {
        filter.yearsOfExperience = {};
        if (minExperience !== undefined) filter.yearsOfExperience.$gte = Number(minExperience);
        if (maxExperience !== undefined) filter.yearsOfExperience.$lte = Number(maxExperience);
    }

    return filter;
};

const fallbackSearch = async (params) => {
    const { page = 1, limit = 6 } = params;
    const pageNum = Math.max(1, Number.parseInt(page));
    const limitNum = Math.min(20, Math.max(1, Number.parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const filter = await buildFallbackFilter(params);

    const [totalCount, mentors] = await Promise.all([
        repo.countByFilter(filter),
        repo.findByFilter(filter, skip, limitNum),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);
    return {
        mentors,
        pagination: { totalCount, totalPages, currentPage: pageNum, hasMore: pageNum < totalPages },
    };
};

// ─────────────────────────────────────────────────────────────
// MAIN SEARCH
// Cognitive complexity reduced from 34 → under 15 by extracting:
//   isPriceRangeInvalid / buildAtlasCompound / buildExpMatch /
//   buildAtlasPipeline / mergeNameMatches / plainList
// ─────────────────────────────────────────────────────────────

const searchMentors = async (params) => {
    const {
        skill = "", name = "", industry = "",
        minPrice, maxPrice, minRating,
        minExperience, maxExperience,
        page = 1, limit = 6,
    } = params;

    const pageNum = Math.max(1, Number.parseInt(page));
    const limitNum = Math.min(20, Math.max(1, Number.parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    if (isPriceRangeInvalid(minPrice, maxPrice)) return emptyPage(pageNum);

    const hasQuery = skill.trim() || name.trim();
    const hasFilters = industry.trim() || minPrice !== undefined || maxPrice !== undefined
        || minRating !== undefined || minExperience !== undefined || maxExperience !== undefined;

    if (!hasQuery && !hasFilters) return plainList(pageNum, limitNum, skip);

    // Step 1 — name search (JS-level union with Atlas results)
    let nameMatchedProfileUserIds = null;
    if (name.trim()) {
        const matchingUsers = await repo.findMentorUsersByName(name.trim());
        nameMatchedProfileUserIds = new Set(matchingUsers.map((u) => u._id.toString()));
    }

    // Step 2 — build Atlas compound + experience post-match
    const compound = buildAtlasCompound({ skill, industry, minPrice, maxPrice, minRating });
    const expMatch = buildExpMatch(minExperience, maxExperience);
    const pipeline = buildAtlasPipeline(compound, expMatch);

    // Step 3 — run Atlas pipeline
    const [facetResult] = await repo.runAtlasPipeline(pipeline);
    let results = facetResult?.results || [];

    // Step 4 — merge any name-matched profiles Atlas missed
    // ✅ Fix
    results = await mergeNameMatches({ results, nameMatchedProfileUserIds, skill, expMatch });

    if (results.length === 0) return emptyPage(pageNum);

    const totalCount = results.length;
    const totalPages = Math.ceil(totalCount / limitNum);
    const paginated = results.slice(skip, skip + limitNum);

    return {
        mentors: paginated,
        pagination: { totalCount, totalPages, currentPage: pageNum, hasMore: pageNum < totalPages },
    };
};

// ─────────────────────────────────────────────────────────────
// AUTOCOMPLETE
// ─────────────────────────────────────────────────────────────

const autocompleteMentors = async ({ q }) => {
    if (!q?.trim()) return [];

    const pipeline = [
        {
            $search: {
                index: "mentor_search",
                compound: {
                    filter: [
                        { equals: { path: "isProfilePublished", value: true } },
                        { equals: { path: "isProfileComplete", value: true } },
                    ],
                    should: [
                        { autocomplete: { query: q.trim(), path: "skills", fuzzy: { maxEdits: 1 } } },
                        { autocomplete: { query: q.trim(), path: "currentRole", fuzzy: { maxEdits: 1 } } },
                        { text: { query: q.trim(), path: "industry", fuzzy: { maxEdits: 1 } } },
                    ],
                },
            },
        },
        { $limit: 5 },
        { $project: { skills: 1, currentRole: 1, industry: 1 } },
    ];

    return repo.runAtlasPipeline(pipeline);
};

module.exports = {
    searchMentors,
    fallbackSearch,
    autocompleteMentors,
};