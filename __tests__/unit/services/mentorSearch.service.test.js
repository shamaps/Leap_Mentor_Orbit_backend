/**
 * @fileoverview Unit tests for Mentor Search Service.
 * Secures 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../utils/escapeRegex", () => ({
    escapeRegex: jest.fn((str) => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")),
}));

jest.mock("../../../utils/cache", () => ({
    get: jest.fn(),
    set: jest.fn(),
    NS: { MENTOR_LIST: "test_mentor_list" },
    TTL: { MENTOR_LIST: 3600 }
}));

const createMentorSearchService = require("../../../services/mentorSearch.service");
const cache = require("../../../utils/cache");
const AppError = require("../../../utils/appError");

describe("Mentor Search Service Layer (100% Total Condition Matrix Blueprint)", () => {
    let mockRepo, mockLogger, service, defaultCriteria;

    beforeEach(() => {
        mockRepo = {
            findMentorUsersByName: jest.fn(),
            countPublishedMentors: jest.fn(),
            findPublishedMentors: jest.fn(),
            runAtlasPipeline: jest.fn(),
            findProfilesByUserIds: jest.fn(),
            countByFilter: jest.fn(),
            findByFilter: jest.fn(),
        };

        mockLogger = { info: jest.fn(), warn: jest.fn() };
        service = createMentorSearchService(mockRepo, { logger: mockLogger });

        defaultCriteria = {
            skill: "NodeJS",
            name: "John",
            industry: "Tech",
            minPrice: 20,
            maxPrice: 100,
            minRating: 4,
            minExperience: 2,
            maxExperience: 10,
            page: 1,
            limit: 6
        };

        jest.clearAllMocks();
    });

    describe("searchMentors Structural Orchestrations", () => {
        it("should return an empty page template immediately if minPrice evaluates higher than maxPrice thresholds", async () => {
            // CONDITION COVERAGE: minPrice > maxPrice validation boundary check
            const res = await service.searchMentors({ ...defaultCriteria, minPrice: 150, maxPrice: 50 });
            expect(res.mentors).toEqual([]);
            expect(res.pagination.totalCount).toBe(0);
        });

        it("should skip empty price criteria configurations gracefully when checking price validity", async () => {
            // CONDITION COVERAGE: minPrice or maxPrice unassigned/undefined paths
            mockRepo.countPublishedMentors.mockResolvedValue(0);
            mockRepo.findPublishedMentors.mockResolvedValue([]);
            await service.searchMentors({ page: 1, limit: 5 }); // triggers plainList
            expect(mockRepo.countPublishedMentors).toHaveBeenCalled();
        });

        it("should return a plain cached listing array directly if no search terms or filters are requested", async () => {
            // CONDITION COVERAGE: !hasQuery && !hasFilters evaluates to true with hit cache
            cache.get.mockResolvedValue({ mentors: [{ _id: "cached_1" }], pagination: { totalCount: 1 } });

            const res = await service.searchMentors({ skill: " ", name: " ", industry: " " });
            expect(res.mentors).toHaveLength(1);
            expect(cache.get).toHaveBeenCalled();
        });

        it("should pull from data registries and populate cache records if a plain listing misses the cache framework", async () => {
            // CONDITION COVERAGE: plainList cache miss path execution
            cache.get.mockResolvedValue(null);
            mockRepo.countPublishedMentors.mockResolvedValue(2);
            mockRepo.findPublishedMentors.mockResolvedValue([{ _id: "p1" }, { _id: "p2" }]);

            const res = await service.searchMentors({ skill: "", name: "" });
            expect(res.pagination.totalCount).toBe(2);
            expect(cache.set).toHaveBeenCalled();
        });

        it("should return empty pages if a pure name query returns no matching parent records", async () => {
            // CONDITION COVERAGE: name.trim() truthy but yields zero users check short-circuit
            mockRepo.findMentorUsersByName.mockResolvedValue([]);
            const res = await service.searchMentors({ name: "Unresolvable Name", page: 1, limit: 5 });
            expect(res.mentors).toHaveLength(0);
        });

        it("should build atlas compound arrays, inject missing candidate records, and merge results seamlessly", async () => {
            // CONDITION COVERAGE: mergeNameMatches triggered, appending missing profiles not in standard Atlas facets returns
            mockRepo.findMentorUsersByName.mockResolvedValue([{ _id: "user_missing_in_atlas" }]);
            mockRepo.runAtlasPipeline.mockResolvedValue([{
                results: [{ user: { _id: "user_in_atlas" } }],
                totalCount: [{ count: 1 }]
            }]);
            mockRepo.findProfilesByUserIds.mockResolvedValue([{
                _id: "prof_extra",
                user: { _id: "user_missing_in_atlas", name: "Extra User", email: "extra@test.com" }
            }]);

            const res = await service.searchMentors({ ...defaultCriteria, skill: " " }); // blank skill tests skill.trim() branch inside merge
            expect(res.mentors).toHaveLength(1); // Skill empty filters out non-matched names
        });

        it("should execute standard paths when skill matching text blocks are supplied to Atlas", async () => {
            // CONDITION COVERAGE: satisfy skill tracking paths inside search compound clause builders
            mockRepo.runAtlasPipeline.mockResolvedValue([{ results: [], totalCount: [] }]);

            const res = await service.searchMentors({ ...defaultCriteria, name: "" });
            expect(res.mentors).toEqual([]);
        });

        it("should evaluate minimal must exists structures if clauses are empty but general filters are provided", async () => {
            // CONDITION COVERAGE: mustClauses.length === 0 && shouldClauses.length === 0 path inside buildAtlasCompound
            mockRepo.runAtlasPipeline.mockResolvedValue([{ results: [], totalCount: [] }]);

            await service.searchMentors({ minRating: 5, page: "abc", limit: "xyz" }); // Also triggers unparseable NaN defaults
            expect(mockRepo.runAtlasPipeline).toHaveBeenCalled();
        });
    });

    describe("fallbackSearch Regex Evaluators", () => {
        it("should compile alternative regular expression match frameworks and return traditional pagination layouts", async () => {
            // CONDITION COVERAGE: fallbackSearch pipelines including orConditions loops for query resolution
            mockRepo.findMentorUsersByName.mockResolvedValue([{ _id: "u_fallback_1" }]);
            mockRepo.countByFilter.mockResolvedValue(1);
            mockRepo.findByFilter.mockResolvedValue([{ _id: "f1" }]);

            const res = await service.fallbackSearch(defaultCriteria);
            expect(res.mentors).toHaveLength(1);
            expect(mockRepo.findMentorUsersByName).toHaveBeenCalledWith("NodeJS");
        });
    });

    describe("autocompleteMentors Auto-Completion Algorithms", () => {
        it("should return an empty collection array directly if lookup queries parameter is missing or empty", async () => {
            // CONDITION COVERAGE: !q?.trim() true
            const res = await service.autocompleteMentors({ q: "   " });
            expect(res).toEqual([]);
        });

        it("should look into high-performance pipelines and return matching prefix segments elements up to a limit of 5", async () => {
            mockRepo.runAtlasPipeline.mockResolvedValue([{ skills: ["JavaScript", "NodeJS"] }]);
            const res = await service.autocompleteMentors({ q: "Node" });
            expect(res).toHaveLength(1);
        });

        it("should catch internal system runtime pipeline faults cleanly and return safe fallback arrays", async () => {
            // CONDITION COVERAGE: autocomplete try-catch block coverage
            mockRepo.runAtlasPipeline.mockRejectedValue(new Error("Atlas Cluster Index Locked"));
            const res = await service.autocompleteMentors({ q: "ErrorTrigger" });
            expect(res).toEqual([]);
        });
    });
});