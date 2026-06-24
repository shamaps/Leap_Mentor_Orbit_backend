// repositories/userSearch.repository.js
const User = require("../models/User");
const { escapeRegex } = require("../utils/escapeRegex");

/**
 * Search users by name using Atlas Search (user_name_search index on `users`).
 * Index fields: name [autocomplete edgeGram 1-15 + string/lucene.standard],
 *               roles [string], isDeleted [boolean].
 *
 * @param {string} query - search term
 * @param {object} [opts]
 * @param {string[]} [opts.roles] - optional roles filter, e.g. ["mentor"]
 * @param {boolean} [opts.includeDeleted=false] - if false, excludes isDeleted:true
 * @param {number} [opts.limit=50] - max results
 */
const findUsersByName = async (query, opts = {}) => {
    const { roles, includeDeleted = false, limit = 50 } = opts;
    const term = query?.trim();
    if (!term) return [];

    const filter = [];
    if (!includeDeleted) {
        filter.push({ equals: { path: "isDeleted", value: false } });
    }
    if (roles?.length) {
        filter.push({
            in: { path: "roles", value: roles },
        });
    }

    try {
        return await User.aggregate([
            {
                $search: {
                    index: "user_name_search",
                    compound: {
                        should: [
                            {
                                autocomplete: {
                                    query: term,
                                    path: "name",
                                    fuzzy: { maxEdits: 1, prefixLength: 1 },
                                    score: { boost: { value: 5 } },
                                },
                            },
                            {
                                text: {
                                    query: term,
                                    path: "name",
                                    fuzzy: { maxEdits: 2, maxExpansions: 50 },
                                },
                            },
                        ],
                        minimumShouldMatch: 1,
                        ...(filter.length ? { filter } : {}),
                    },
                },
            },
            { $project: { _id: 1, name: 1, email: 1 } },
            { $limit: limit },
        ]);
    } catch {
        // Fallback if Atlas index is unavailable
        const regexFilter = { name: { $regex: escapeRegex(term), $options: "i" } };
        if (!includeDeleted) regexFilter.isDeleted = { $ne: true };
        if (roles?.length) regexFilter.roles = { $in: roles };

        return User.find(regexFilter, null, { ignoreIsDeleted: true })
            .select("_id name email")
            .limit(limit)
            .lean();
    }
};

module.exports = { findUsersByName };