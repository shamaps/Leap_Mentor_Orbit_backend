// controllers/mentorSearch.controller.js
const MentorProfile = require("../models/MentorProfile");
const User = require("../models/User");
/**
* GET /api/mentors/search
* Atlas Search — fuzzy full-text search on skills, currentRole, industry, company
* Falls back to name filtering via $lookup on User collection
*
* Query params:
* skill — fuzzy match on skills, currentRole, industry, company
* name — exact-ish match on mentor's name (post-lookup filter)
* industry — filter by industry
* minPrice — hourlyRate >= minPrice
* maxPrice — hourlyRate <= maxPrice
* minRating — avgRating >= minRating
* page — pagination (default: 1)
* limit — results per page (default: 6, max: 20)
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
const pageNum = Math.max(1, parseInt(page));
const limitNum = Math.min(20, Math.max(1, parseInt(limit)));
const skip = (pageNum - 1) * limitNum;
// ── Build Atlas Search compound query ────────────────────
// must = filters that always apply (non-negotiable)
// should = full-text fuzzy search (boosts relevance score)
const mustClauses = [];
const shouldClauses = [];
const filterClauses = [];
// ── Base filter — published + complete profiles only ─────
mustClauses.push({
equals: { path: "isProfilePublished", value: true },
});
mustClauses.push({
equals: { path: "isProfileComplete", value: true },
});
// ── Fuzzy full-text search ───────────────────────────────
// maxEdits: 1 = tolerates 1 typo ("Reakt" → "React")
// prefixLength:2 = first 2 chars must be exact (performance guard)
const searchTerm = (skill || name).trim();
if (searchTerm) {
shouldClauses.push({
text: {
query: searchTerm,
path: ["skills", "currentRole", "industry", "company"],
fuzzy: { maxEdits: 1, prefixLength: 2 },
score: { boost: { value: 3 } }, // skills/role matches rank higher
},
});
}
// ── Industry filter ──────────────────────────────────────
if (industry.trim()) {
mustClauses.push({
text: {
query: industry.trim(),
path: "industry",
fuzzy: { maxEdits: 1 },
},
});
}
// ── Price range filter ───────────────────────────────────
if (minPrice !== undefined || maxPrice !== undefined) {
const rangeClause = { range: { path: "hourlyRate" } };
if (minPrice !== undefined) rangeClause.range.gte = Number(minPrice);
if (maxPrice !== undefined) rangeClause.range.lte = Number(maxPrice);
filterClauses.push(rangeClause);
}
// ── Rating filter ────────────────────────────────────────
if (minRating !== undefined) {
filterClauses.push({
range: { path: "avgRating", gte: Number(minRating) },
});
}
// ── Assemble compound clause ─────────────────────────────
const compound = { must: mustClauses };
if (shouldClauses.length > 0) compound.should = shouldClauses;
if (filterClauses.length > 0) compound.filter = filterClauses;
// ── Build aggregation pipeline ───────────────────────────
const pipeline = [
// 1️⃣ Atlas Search
{
$search: {
index: "mentor_search",
compound,
},
},
// 2️⃣ Add relevance score field
{
$addFields: {
searchScore: { $meta: "searchScore" },
},
},
// 3️⃣ Join User collection to get name + email
{
$lookup: {
from: "users",
localField: "user",
foreignField: "_id",
as: "userDoc",
},
},
// 4️⃣ Flatten the userDoc array → single object
{
$unwind: {
path: "$userDoc",
preserveNullAndEmptyArrays: false, // drop profiles with no user
},
},
// 5️⃣ Filter by name if provided (post-lookup)
...(name.trim()
? [{
$match: {
"userDoc.name": { $regex: name.trim(), $options: "i" },
},
}]
: []),
// 6️⃣ Facet — get paginated results + total count in ONE query
{
$facet: {
results: [
{ $sort: { searchScore: -1, avgRating: -1 } },
{ $skip: skip },
{ $limit: limitNum },
{
$project: {
_id: 1,
currentRole: 1,
industry: 1,
company: 1,
skills: 1,
hourlyRate: 1,
avgRating: 1,
profilePicture: 1,
linkedInUrl: 1,
portfolioUrl: 1,
searchScore: 1,
user: {
id: "$userDoc.id",
name: "$userDoc.name",
email: "$userDoc.email",
},
},
},
],
totalCount: [
{ $count: "count" },
],
},
},
];
// ── Execute pipeline ─────────────────────────────────────
const [facetResult] = await MentorProfile.aggregate(pipeline);
const mentors = facetResult?.results || [];
const totalCount = facetResult?.totalCount?.[0]?.count || 0;
const totalPages = Math.ceil(totalCount / limitNum);
return res.status(200).json({
success: true,
mentors,
pagination: {
totalCount,
totalPages,
currentPage: pageNum,
hasMore: pageNum < totalPages,
},
});
} catch (err) {
console.error("❌ Mentor search error:", err.message);
// ── Fallback — if Atlas Search index not ready yet ───────
// Uncomment this block during Atlas index creation/propagation
// if (err.message.includes("$search")) {
// return fallbackSearch(req, res);
// }
return res.status(500).json({
success: false,
message: "Server error while searching mentors",
});
}
};
/**
* GET /api/mentors/autocomplete
* Lightweight autocomplete for the search bar dropdown
* Uses a separate Atlas autocomplete index for edgeGram tokenization
*/
const autocompleteMentors = async (req, res) => {
try {
const { q = "" } = req.query;
if (!q.trim()) {
return res.json({ success: true, suggestions: [] });
}
const pipeline = [
{
$search: {
index: "mentor_autocomplete",
compound: {
must: [
{ equals: { path: "isProfilePublished", value: true } },
{ equals: { path: "isProfileComplete", value: true } },
],
should: [
{
autocomplete: {
query: q.trim(),
path: "skills",
fuzzy: { maxEdits: 1 },
},
},
{
autocomplete: {
query: q.trim(),
path: "currentRole",
fuzzy: { maxEdits: 1 },
},
},
],
},
},
},
{ $limit: 8 },
{
$project: {
skills: 1,
currentRole: 1,
_id: 0,
},
},
];
const results = await MentorProfile.aggregate(pipeline);
// ── Flatten skills into unique suggestion list ────────────
const skillSet = new Set();
const roleSet = new Set();
results.forEach((r) => {
r.skills?.forEach((s) => {
if (s.toLowerCase().includes(q.toLowerCase())) skillSet.add(s);
});
if (r.currentRole?.toLowerCase().includes(q.toLowerCase())) {
roleSet.add(r.currentRole);
}
});
const suggestions = [
...[...skillSet].slice(0, 5).map((s) => ({ type: "skill", label: s })),
...[...roleSet].slice(0, 3).map((r) => ({ type: "role", label: r })),
];
return res.json({ success: true, suggestions });
} catch (err) {
console.error("❌ Autocomplete error:", err.message);
return res.json({ success: true, suggestions: [] }); // fail silently
}
};
module.exports = { searchMentors, autocompleteMentors };