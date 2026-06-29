// backend/services/mentorSearch.service.js
// Atlas Search index: mentor_search on mentorprofiles collection
// Atlas Search index: user_name_search on users collection
// Index definitions: config/atlasSearchIndexes.json
const { escapeRegex } = require("../utils/escapeRegex");
const cache = require("../utils/cache");

/**
 * @typedef {Object} SearchPagination
 * @property {number} totalCount - Total matching documents available.
 * @property {number} totalPages - Total computed pagination pages.
 * @property {number} currentPage - Current active page number.
 * @property {boolean} hasMore - Operational flag indicating whether additional records follow.
 */

/**
 * @typedef {Object} MentorSearchRepository
 * @property {(name: string) => Promise<Object[]>} findMentorUsersByName - Runs Atlas autocomplete or regex backup on user collection names.
 * @property {() => Promise<number>} countPublishedMentors - Obtains count of active published profiles.
 * @property {(skip: number, limit: number) => Promise<Object[]>} findPublishedMentors - Returns plain profiles sorted by score.
 * @property {(pipeline: Object[]) => Promise<Object[]>} runAtlasPipeline - Executes raw aggregation arrays inside the DB engine.
 * @property {(userIds: string[], expMatch: Object) => Promise<Object[]>} findProfilesByUserIds - Resolves missing named matches.
 * @property {(filter: Object) => Promise<number>} countByFilter - Counts documents using traditional Mongo filters.
 * @property {(filter: Object, skip: number, limit: number) => Promise<Object[]>} findByFilter - Pulls records using backup regex filters.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string, meta?: Object) => void} info - Monitors execution routes.
 * @property {(message: string, meta?: Object) => void} warn - Captures index failure degradations.
 */

/**
 * Factory constructing the Atlas Search and fallback orchestration layer.
 * * @param {MentorSearchRepository} repo - Abstraction data registry layer instance.
 * @param {{ logger: Logger }} dependencies - Telemetry log instrumentation utilities block.
 * @returns {Object} Configured object map containing search execution methods.
 */
const createMentorSearchService = (repo, { logger }) => {

    /**
     * Instantiates an empty page layout model envelope fallback.
     * * @private
     * @function emptyPage
     * @param {number} pageNum - The page number context mapping index.
     * @returns {{mentors: Array, pagination: SearchPagination}} Empty search results data block structural template.
     */
    const emptyPage = (pageNum) => ({
        mentors: [],
        pagination: { totalCount: 0, totalPages: 0, currentPage: pageNum, hasMore: false },
    });

    /**
     * Evaluates parameters evaluating if floor parameters drop criteria below logical bounds.
     * * @private
     * @function isPriceRangeInvalid
     * @param {number|string|undefined} minPrice - Minimum rate parameter bound.
     * @param {number|string|undefined} maxPrice - Maximum rate parameter bound.
     * @returns {boolean} True if price thresholds evaluate as conflicting.
     */
    const isPriceRangeInvalid = (minPrice, maxPrice) => {
        if (minPrice === undefined || maxPrice === undefined) return false;
        const min = Number(minPrice);
        const max = Number(maxPrice);
        return !Number.isNaN(min) && !Number.isNaN(max) && min > max;
    };

    /**
     * Formulates complex multi-clause compound query parameters targeted at Atlas cluster search indices.
     * * @private
     * @function buildAtlasCompound
     * @param {Object} criteria - Filters criteria configuration container mapping search tokens.
     * @param {string} criteria.skill - Wildcard skill token targeted across multiple paths.
     * @param {string} criteria.industry - Mandatory industry domain value filter text.
     * @param {number|string} [criteria.minPrice] - Minimum cost rate option limit selector.
     * @param {number|string} [criteria.maxPrice] - Maximum cost rate option limit selector.
     * @param {number|string} [criteria.minRating] - Floor score filter limit constraint checking option.
     * @returns {Object} Atlas search query schema compound filter block context.
     */
    const buildAtlasCompound = ({ skill, industry, minPrice, maxPrice, minRating }) => {
        const filterClauses = [
            { equals: { path: "isProfilePublished", value: true } },
            { equals: { path: "isProfileComplete", value: true } },
        ];
        const mustClauses = [];
        const shouldClauses = [];

        if (skill.trim()) {
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
            compound.minimumShouldMatch = 1;
        }

        if (mustClauses.length === 0 && shouldClauses.length === 0) {
            compound.must = [{ exists: { path: "isProfilePublished" } }];
        }

        return compound;
    };

    /**
     * Builds relational experience range parameters queries.
     * * @private
     * @function buildExpMatch
     * @param {number|string} minExperience - Floor experience parameter.
     * @param {number|string} maxExperience - Ceiling experience parameter.
     * @returns {Object} Mongoose traditional query match payload criteria configuration.
     */
    const buildExpMatch = (minExperience, maxExperience) => {
        if (minExperience === undefined && maxExperience === undefined) return {};
        const match = { yearsOfExperience: {} };
        if (minExperience !== undefined) match.yearsOfExperience.$gte = Number(minExperience);
        if (maxExperience !== undefined) match.yearsOfExperience.$lte = Number(maxExperience);
        return match;
    };

    /**
     * Compiles entire native DB pipeline operations aggregating text score parameters alongside deep user projections.
     * * @private
     * @function buildAtlasPipeline
     * @param {Object} compound - Prepared filter schemas mapped context payload envelope.
     * @param {Object} expMatch - Post-filter relational checks matching metrics criteria.
     * @param {number} skip - Offset density index allocation parameters.
     * @param {number} limitNum - Sizing ceiling tracking output page sizes.
     * @returns {Object[]} Sequential operational DB pipeline query blocks configuration data array.
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
                results: [
                    { $sort: { searchScore: -1 } },
                    { $skip: skip },
                    { $limit: limitNum },
                ],
                totalCount: [{ $count: "count" }],
            },
        },
    ];

    /**
     * Re-injects candidate profiles that native indices skipped because human names live in parent collections.
     * * @private
     * @async
     * @function mergeNameMatches
     * @param {Object} payloadData - Input parameters checking matching matrices configurations.
     * @param {Object[]} payloadData.results - Output rows extracted via Atlas pipeline runs.
     * @param {Set<string>|null} payloadData.nameMatchedProfileUserIds - Set arrays tracking user primary indices located via name queries.
     * @param {string} payloadData.skill - Core validation check parameters verifying if context focuses exclusively on name tokens.
     * @param {Object} payloadData.expMatch - Traditional experience parameters query matching definitions.
     * @returns {Promise<Object[]>} Overlapping union of merged profile data arrays rows.
     */
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

        if (!skill.trim()) {
            results = results.filter((r) =>
                nameMatchedProfileUserIds.has(r.user._id.toString())
            );
        }

        return results;
    };

    /**
     * Resolves plain, rating-ordered summary metrics cards backed by high-performance cache frameworks.
     * * @private
     * @async
     * @function plainList
     * @param {number} pageNum - Target tracking dynamic page selector indicator.
     * @param {number} limitNum - Capacity sizing limit threshold configuration data parameters.
     * @param {number} skip - Offset elements allocation counts.
     * @returns {Promise<Object>} Cached or newly compiled query page layout details containing mentors and indicators.
     */
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

    /**
     * Formulates traditional evaluation expression blocks for handling search matching queries via regex fallback structures.
     * * @private
     * @async
     * @function buildFallbackFilter
     * @param {Object} parameters - Dynamic parameters container tracking input fields.
     * @returns {Promise<Object>} Traditional Mongoose evaluation match filter block parameters statement.
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

    /**
     * Executes backup queries relying on regular expression parsing hooks when core indices are non-existent.
     * * @async
     * @function fallbackSearch
     * @param {Object} params - Intake filters parameter data context packages.
     * @returns {Promise<{mentors: Object[], pagination: SearchPagination}>} Traditional pagination data envelope containing mentors.
     */
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

    /**
     * Core orchestrator balancing multi-stage verification steps, combining name token checks, executing pipelines, and merging union profiles.
     * * @async
     * @function searchMentors
     * @param {Object} params - Context package holding parameters criteria options.
     * @param {string} [params.skill=""] - Input skill label matching token.
     * @param {string} [params.name=""] - Input name literal matching expression metrics.
     * @param {string} [params.industry=""] - Industry field filter selection tag.
     * @param {number|string} [params.minPrice] - Minimum pricing limit constraint indicator.
     * @param {number|string} [params.maxPrice] - Maximum pricing limit constraint indicator.
     * @param {number|string} [params.minRating] - Floor score value boundary configuration parameters.
     * @param {number|string} [params.minExperience] - Floor experience range boundary parameter.
     * @param {number|string} [params.maxExperience] - Ceiling experience range boundary parameter.
     * @param {number|string} [params.page=1] - Dynamic page selector index value.
     * @param {number|string} [params.limit=6] - Sizing layout elements total counts limit indicator.
     * @returns {Promise<{mentors: Object[], pagination: SearchPagination}>} Fully parsed structural pagination metrics container data.
     */
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

        if (!hasQuery && !hasFilters) return plainList(pageNum, limitNum, skip);

        let nameMatchedProfileUserIds = null;
        if (name.trim()) {
            const matchingUsers = await repo.findMentorUsersByName(name.trim());
            nameMatchedProfileUserIds = new Set(matchingUsers.map((u) => u._id.toString()));
            if (!skill.trim() && !hasFilters && nameMatchedProfileUserIds.size === 0) {
                return emptyPage(pageNum);
            }
        }

        const compound = buildAtlasCompound({ skill, industry, minPrice, maxPrice, minRating });
        const expMatch = buildExpMatch(minExperience, maxExperience);
        const pipeline = buildAtlasPipeline(compound, expMatch, skip, limitNum);

        const [facetResult] = await repo.runAtlasPipeline(pipeline);
        let results = facetResult?.results || [];
        const dbTotal = facetResult?.totalCount?.[0]?.count ?? 0;

        logger.info("Atlas search executed", {
            skill, name, industry,
            atlasResults: results.length,
            dbTotal,
        });

        results = await mergeNameMatches({ results, nameMatchedProfileUserIds, skill, expMatch });

        if (results.length === 0) return emptyPage(pageNum);

        const totalCount = nameMatchedProfileUserIds ? results.length : dbTotal;
        const totalPages = Math.ceil(totalCount / limitNum);

        return {
            mentors: results,
            pagination: { totalCount, totalPages, currentPage: pageNum, hasMore: pageNum < totalPages },
        };
    };

    /**
     * Drives highly contextual auto-completion algorithms querying prefix characters to guess technical competencies.
     * * @async
     * @function autocompleteMentors
     * @param {Object} queryParams - Input text frame parameter parameters payload.
     * @param {string} queryParams.q - Prefix characters sequence entry tracking input value.
     * @returns {Promise<Object[]>} Dynamic recommendation items collection limited to 5 elements, or an empty fallback array.
     */
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