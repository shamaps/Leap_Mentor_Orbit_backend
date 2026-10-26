// repositories/userSearch.repository.js
const User = require("../models/User");
const { escapeRegex } = require("../utils/escapeRegex");

/**
 * Search options parameters context configuring filter bounds.
 * @typedef {Object} UserSearchOptions
 * @property {string[]} [roles] - Array tracking requested access level scopes filtering (e.g., ["mentor"]).
 * @property {boolean} [includeDeleted=false] - Operational toggle indicating whether soft-deleted entries are bypassed.
 * @property {number} [limit=50] - Capacity threshold limit parameter defining page block slice thickness.
 */

/**
 * Search users by name using Atlas Search (user_name_search index on `users`).
 * Index fields: name [autocomplete edgeGram 1-15 + string/lucene.standard],
 * roles [string], isDeleted [boolean].
 * * Pivots smoothly to a case-insensitive case regex pipeline if the cluster search indices fall back.
 * * @async
 * @function findUsersByName
 * @param {string} query - Unprocessed character name string lookup criteria.
 * @param {UserSearchOptions} [opts={}] - Sizing limits and criteria flags parameter layout details.
 * @returns {Promise<Array<{_id: any, name: string, email: string}>>} Lean collection detailing matching user structures records.
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