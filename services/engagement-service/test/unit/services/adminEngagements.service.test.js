/**
 * @fileoverview Unit tests for the Admin Engagements Service.
 * Covers the status counters and the filtered, paginated engagement list that
 * moved here from the identity service.
 */

const createAdminEngagementsService = require("../../../src/services/adminEngagements.service");

describe("Admin Engagements Service", () => {
    let repo, service;

    beforeEach(() => {
        repo = {
            countEngagementsByStatus: jest.fn(),
            countEngagements: jest.fn().mockResolvedValue(0),
            findEngagements: jest.fn().mockResolvedValue([]),
            findUserIdsBySearchTerm: jest.fn(),
        };
        service = createAdminEngagementsService(repo);
    });

    describe("fetchEngagementStats", () => {
        it("should count every status separately and add them up into a total", async () => {
            const byStatus = { pending: 1, accepted: 2, rejected: 3, referred: 4, ongoing: 5, completed: 6 };
            repo.countEngagementsByStatus.mockImplementation(async (status) => byStatus[status]);

            const stats = await service.fetchEngagementStats();

            expect(stats).toEqual({ ...byStatus, total: 21 });
            expect(repo.countEngagementsByStatus).toHaveBeenCalledTimes(6);
            Object.keys(byStatus).forEach((status) => expect(repo.countEngagementsByStatus).toHaveBeenCalledWith(status));
        });

        it("should report a total of zero when nothing exists", async () => {
            repo.countEngagementsByStatus.mockResolvedValue(0);
            await expect(service.fetchEngagementStats()).resolves.toMatchObject({ total: 0, pending: 0, completed: 0 });
        });

        it("should propagate a repository failure", async () => {
            repo.countEngagementsByStatus.mockRejectedValue(new Error("db down"));
            await expect(service.fetchEngagementStats()).rejects.toThrow("db down");
        });
    });

    describe("fetchEngagements", () => {
        it("should use an empty filter and the first page of 15 when called with no options", async () => {
            repo.countEngagements.mockResolvedValue(40);
            repo.findEngagements.mockResolvedValue([{ _id: "e1" }]);

            const res = await service.fetchEngagements({});

            expect(repo.countEngagements).toHaveBeenCalledWith({});
            expect(repo.findEngagements).toHaveBeenCalledWith({}, 0, 15);
            expect(res).toEqual({
                engagements: [{ _id: "e1" }],
                pagination: { total: 40, page: 1, limit: 15, totalPages: 3 },
            });
            expect(repo.findUserIdsBySearchTerm).not.toHaveBeenCalled();
        });

        it("should filter by status", async () => {
            await service.fetchEngagements({ status: "ongoing" });
            expect(repo.countEngagements).toHaveBeenCalledWith({ status: "ongoing" });
        });

        it("should apply only a lower date bound when dateFrom is given", async () => {
            await service.fetchEngagements({ dateFrom: "2026-01-01" });

            const filter = repo.countEngagements.mock.calls[0][0];
            expect(filter.requestedAt.$gte).toEqual(new Date("2026-01-01"));
            expect(filter.requestedAt.$lte).toBeUndefined();
        });

        it("should make the upper date bound inclusive of the whole last day", async () => {
            await service.fetchEngagements({ dateTo: "2026-03-01" });

            const { $lte, $gte } = repo.countEngagements.mock.calls[0][0].requestedAt;
            expect($gte).toBeUndefined();
            expect([$lte.getHours(), $lte.getMinutes(), $lte.getSeconds(), $lte.getMilliseconds()]).toEqual([23, 59, 59, 999]);
        });

        it("should apply both date bounds together", async () => {
            await service.fetchEngagements({ dateFrom: "2026-01-01", dateTo: "2026-03-01" });
            expect(Object.keys(repo.countEngagements.mock.calls[0][0].requestedAt).sort()).toEqual(["$gte", "$lte"]);
        });

        it("should resolve a search term to user ids and match them as mentor or mentee", async () => {
            repo.findUserIdsBySearchTerm.mockResolvedValue(["u1", "u2"]);

            await service.fetchEngagements({ search: "  Jane  " });

            expect(repo.findUserIdsBySearchTerm).toHaveBeenCalledWith("Jane"); // trimmed
            expect(repo.countEngagements).toHaveBeenCalledWith({
                $or: [{ mentor: { $in: ["u1", "u2"] } }, { mentee: { $in: ["u1", "u2"] } }],
            });
        });

        it("should match nothing when the search finds no users", async () => {
            repo.findUserIdsBySearchTerm.mockResolvedValue([]);
            await service.fetchEngagements({ search: "nobody" });
            expect(repo.countEngagements).toHaveBeenCalledWith({ $or: [{ mentor: { $in: [] } }, { mentee: { $in: [] } }] });
        });

        it("should ignore a search term that is only whitespace", async () => {
            await service.fetchEngagements({ search: "   " });
            expect(repo.findUserIdsBySearchTerm).not.toHaveBeenCalled();
            expect(repo.countEngagements).toHaveBeenCalledWith({});
        });

        it("should combine status, dates and search into one filter", async () => {
            repo.findUserIdsBySearchTerm.mockResolvedValue(["u1"]);

            await service.fetchEngagements({ status: "ongoing", search: "Jane", dateFrom: "2026-01-01", dateTo: "2026-03-01" });

            expect(repo.countEngagements).toHaveBeenCalledWith(expect.objectContaining({
                status: "ongoing",
                requestedAt: expect.any(Object),
                $or: expect.any(Array),
            }));
        });

        it("should turn string page and limit values into numbers and skip the earlier pages", async () => {
            repo.countEngagements.mockResolvedValue(25);

            const res = await service.fetchEngagements({ page: "3", limit: "10" });

            expect(repo.findEngagements).toHaveBeenCalledWith({}, 20, 10);
            expect(res.pagination).toEqual({ total: 25, page: 3, limit: 10, totalPages: 3 });
        });

        it("should report zero pages when there are no results", async () => {
            const res = await service.fetchEngagements({});
            expect(res.pagination.totalPages).toBe(0);
        });

        it("should propagate a repository failure", async () => {
            repo.findEngagements.mockRejectedValue(new Error("query failed"));
            await expect(service.fetchEngagements({})).rejects.toThrow("query failed");
        });
    });
});
