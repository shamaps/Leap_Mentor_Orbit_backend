// backend/services/mentorSearch.service.js
// Atlas Search index: mentor_search on mentorprofiles collection
// Atlas Search index: user_name_search on users collection
// Index definitions: config/atlasSearchIndexes.json
const { escapeRegex } = require("../utils/escapeRegex");
const cache = require("../utils/cache");
const createMentorSearchService = (repo, { logger }) => {

    // ── Helpers ──────────────────────────────────────────────────────────────

    const emptyPage = (pageNum) => ({
        mentors: [],
        pagination: { totalCount: 0, totalPages: 0, currentPage: pageNum, hasMore: false },
    });

    const isPriceRangeInvalid = (minPrice, maxPrice) => {
        if (minPrice === undefined || maxPrice === undefined) return false;
        const min = Number(minPrice);
        const max = Number(maxPrice);
        return !Number.isNaN(min) && !Number.isNaN(max) && min > max;
    };

    // ── Atlas pipeline builders ───────────────────────────────────────────────

    /**
     * skill/name/industry/price/rating → Atlas compound clause
     * KEY FIX: when no skill/industry typed, we still need a `must` clause
     * so Atlas returns results. We use a wildcard match-all for that case.
     */
    const buildAtlasCompound = ({ skill, industry, minPrice, maxPrice, minRating }) => {
        const filterClauses = [
            { equals: { path: "isProfilePublished", value: true } },
            { equals: { path: "isProfileComplete", value: true } },
        ];
        const mustClauses = [];
        const shouldClauses = [];

        if (skill.trim()) {
            // autocomplete: handles prefix typing ("reac" → "react")
            shouldClauses.push(
                {
                    autocomplete: {
                        query: skill.trim(),
                        path: "skills",
                        fuzzy: { maxEdits: 1, prefixLength: 1 },
                        score: { boost: { value: 10 } },
                    },
                },
                {
                    autocomplete: {
                        query: skill.trim(),
                        path: "currentRole",
                        fuzzy: { maxEdits: 1, prefixLength: 1 },
                        score: { boost: { value: 5 } },
                    },
                },
                // text: handles full-word typos ("reactee" → "react")
                {
                    text: {
                        query: skill.trim(),
                        path: "skills",
                        fuzzy: { maxEdits: 2, prefixLength: 1 },
                        score: { boost: { value: 8 } },
                    },
                },
                {
                    text: {
                        query: skill.trim(),
                        path: ["industry", "company"],
                        fuzzy: { maxEdits: 1, prefixLength: 1 },
                        score: { boost: { value: 3 } },
                    },
                }
            );
        }

        if (industry.trim()) {
            mustClauses.push({
                text: {
                    query: industry.trim(),
                    path: "industry",
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

        if (mustClauses.length > 0) compound.must = mustClauses;
        if (shouldClauses.length > 0) {
            compound.should = shouldClauses;
            compound.minimumShouldMatch = 1; // ← KEY: at least 1 should must match
        }

        // KEY FIX: if no must AND no should, Atlas returns nothing with only filter.
        // Add a wildcard exists clause so filter-only queries still return results.
        if (mustClauses.length === 0 && shouldClauses.length === 0) {
            compound.must = [{ exists: { path: "isProfilePublished" } }];
        }

        return compound;
    };

    const buildExpMatch = (minExperience, maxExperience) => {
        if (minExperience === undefined && maxExperience === undefined) return {};
        const match = { yearsOfExperience: {} };
        if (minExperience !== undefined) match.yearsOfExperience.$gte = Number(minExperience);
        if (maxExperience !== undefined) match.yearsOfExperience.$lte = Number(maxExperience);
        return match;
    };

    /**
     * Full Atlas aggregation pipeline.
     * Pagination ($skip/$limit) happens INSIDE MongoDB — not in Node.js.
     * totalCount also computed in DB via $facet second bucket.
     */
    const buildAtlasPipeline = (compound, expMatch, skip, limitNum) => [
        { $search: { index: "mentor_search", compound } },
        { $addFields: { searchScore: { $meta: "searchScore" } } },
        ...(Object.keys(expMatch).length > 0 ? [{ $match: expMatch }] : []),
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userDoc",
            },
        },
        { $unwind: { path: "$userDoc", preserveNullAndEmptyArrays: false } },
        {
            $project: {
                user: {
                    _id: "$userDoc._id",
                    name: "$userDoc.name",
                    email: "$userDoc.email",
                },
                currentRole: 1, industry: 1, company: 1, skills: 1,
                hourlyRate: 1, avgRating: 1, profilePicture: 1,
                linkedInUrl: 1, portfolioUrl: 1, yearsOfExperience: 1,
                bio: 1, verificationStatus: 1, searchScore: 1,
            },
        },
        {
            $facet: {
                // Pagination inside DB — NOT sliced in Node.js
                results: [
                    { $sort: { searchScore: -1 } },
                    { $skip: skip },
                    { $limit: limitNum },
                ],
                // Count inside DB
                totalCount: [{ $count: "count" }],
            },
        },
    ];

    // ── Name-match union ──────────────────────────────────────────────────────

    const mergeNameMatches = async ({ results, nameMatchedProfileUserIds, skill, expMatch }) => {
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

        // Name-only search (no skill) → only show name-matched profiles
        if (!skill.trim()) {
            results = results.filter((r) =>
                nameMatchedProfileUserIds.has(r.user._id.toString())
            );
        }

        return results;
    };

    // ── Plain list ────────────────────────────────────────────────────────────

    const plainList = async (pageNum, limitNum, skip) => {
        const key = `${cache.NS.MENTOR_LIST}:page${pageNum}:limit${limitNum}`;
        const cached = await cache.get(key);
        if (cached) return cached;

        const [totalCount, mentors] = await Promise.all([
            repo.countPublishedMentors(),
            repo.findPublishedMentors(skip, limitNum),
        ]);
        const totalPages = Math.ceil(totalCount / limitNum);
        const result = {
            mentors,
            pagination: { totalCount, totalPages, currentPage: pageNum, hasMore: pageNum < totalPages },
        };
        await cache.set(key, result, cache.TTL.MENTOR_LIST);
        return result;
    };

    // ── Fallback (regex — when Atlas index doesn't exist) ─────────────────────

    const buildFallbackFilter = async ({ skill, name, industry, minPrice, maxPrice, minRating, minExperience, maxExperience }) => {
        const query = skill.trim() || name.trim();
        const filter = { isProfilePublished: true, isProfileComplete: true };

        if (query) {
            const matchingUsers = await repo.findMentorUsersByName(query);
            const orConditions = [];
            if (matchingUsers.length > 0) {
                orConditions.push({ user: { $in: matchingUsers.map((u) => u._id) } });
            }
            orConditions.push({
                skills: { $elemMatch: { $regex: escapeRegex(query), $options: "i" } },
            });
            filter.$or = orConditions;
        }

        if (industry.trim()) filter.industry = { $regex: escapeRegex(industry.trim()), $options: "i" };
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

    // ── MAIN SEARCH ───────────────────────────────────────────────────────────

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
        const hasFilters = industry.trim()
            || minPrice !== undefined || maxPrice !== undefined
            || minRating !== undefined || minExperience !== undefined
            || maxExperience !== undefined;

        // No query, no filters → plain list sorted by rating
        if (!hasQuery && !hasFilters) return plainList(pageNum, limitNum, skip);

        // Step 1 — name search via Atlas (user_name_search index)
        let nameMatchedProfileUserIds = null;
        if (name.trim()) {
            const matchingUsers = await repo.findMentorUsersByName(name.trim());
            nameMatchedProfileUserIds = new Set(matchingUsers.map((u) => u._id.toString()));
            // If name given but zero matches → nothing to show
            if (!skill.trim() && !hasFilters && nameMatchedProfileUserIds.size === 0) {
                return emptyPage(pageNum);
            }
        }

        // Step 2 — build Atlas compound + experience post-filter
        const compound = buildAtlasCompound({ skill, industry, minPrice, maxPrice, minRating });
        const expMatch = buildExpMatch(minExperience, maxExperience);
        const pipeline = buildAtlasPipeline(compound, expMatch, skip, limitNum);

        // Step 3 — run Atlas pipeline
        const [facetResult] = await repo.runAtlasPipeline(pipeline);
        let results = facetResult?.results || [];
        const dbTotal = facetResult?.totalCount?.[0]?.count ?? 0;

        logger.info("Atlas search executed", {
            skill, name, industry,
            atlasResults: results.length,
            dbTotal,
        });

        // Step 4 — merge name-matched profiles Atlas missed
        results = await mergeNameMatches({ results, nameMatchedProfileUserIds, skill, expMatch });

        if (results.length === 0) return emptyPage(pageNum);

        const totalCount = nameMatchedProfileUserIds ? results.length : dbTotal;
        const totalPages = Math.ceil(totalCount / limitNum);

        return {
            mentors: results,
            pagination: { totalCount, totalPages, currentPage: pageNum, hasMore: pageNum < totalPages },
        };
    };

    // ── AUTOCOMPLETE ──────────────────────────────────────────────────────────

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
                        must: [
                            {
                                autocomplete: {
                                    query: q.trim(),
                                    path: "skills",
                                    fuzzy: { maxEdits: 1, prefixLength: 1 },
                                },
                            },
                        ],
                    },
                },
            },
            { $limit: 5 },
            { $project: { skills: 1, currentRole: 1, industry: 1 } },
        ];

        try {
            return await repo.runAtlasPipeline(pipeline);
        } catch {
            return [];
        }
    };

    return { searchMentors, fallbackSearch, autocompleteMentors };
};

module.exports = createMentorSearchService;