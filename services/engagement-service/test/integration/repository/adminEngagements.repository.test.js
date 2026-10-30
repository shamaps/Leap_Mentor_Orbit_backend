/**
 * @fileoverview Tests for the Admin Engagements Repository.
 * The mongoose models and the Atlas name search are mocked, so these check the
 * exact queries built, not the database engine.
 */

const mockQuery = {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn(),
};

jest.mock("@leapmentor/shared/models/ConnectRequest", () => ({
    countDocuments: jest.fn(),
    find: jest.fn(() => mockQuery),
}));

jest.mock("@leapmentor/shared/models/User", () => ({
    find: jest.fn(() => mockQuery),
}));

jest.mock("@leapmentor/shared/repositories/userSearch.repository", () => ({
    findUsersByName: jest.fn(),
}));

const ConnectRequest = require("@leapmentor/shared/models/ConnectRequest");
const User = require("@leapmentor/shared/models/User");
const { findUsersByName } = require("@leapmentor/shared/repositories/userSearch.repository");
const repository = require("../../../src/repositories/adminEngagements.repository");

describe("Admin Engagements Repository", () => {
    beforeEach(() => jest.clearAllMocks());

    describe("counts", () => {
        it("should count engagements with one status", async () => {
            ConnectRequest.countDocuments.mockResolvedValue(7);
            await expect(repository.countEngagementsByStatus("ongoing")).resolves.toBe(7);
            expect(ConnectRequest.countDocuments).toHaveBeenCalledWith({ status: "ongoing" });
        });

        it("should count engagements matching an arbitrary filter", async () => {
            const filter = { status: "pending", mentor: { $in: ["u1"] } };
            ConnectRequest.countDocuments.mockResolvedValue(2);
            await expect(repository.countEngagements(filter)).resolves.toBe(2);
            expect(ConnectRequest.countDocuments).toHaveBeenCalledWith(filter);
        });
    });

    describe("findEngagements", () => {
        it("should populate both people, sort newest first, paginate and return plain objects", async () => {
            mockQuery.lean.mockResolvedValue([{ _id: "e1" }]);
            const filter = { status: "ongoing" };

            const result = await repository.findEngagements(filter, 30, 15);

            expect(ConnectRequest.find).toHaveBeenCalledWith(filter);
            expect(mockQuery.populate).toHaveBeenNthCalledWith(1, "mentor", "name email");
            expect(mockQuery.populate).toHaveBeenNthCalledWith(2, "mentee", "name email");
            expect(mockQuery.sort).toHaveBeenCalledWith({ requestedAt: -1 });
            expect(mockQuery.skip).toHaveBeenCalledWith(30);
            expect(mockQuery.limit).toHaveBeenCalledWith(15);
            expect(result).toEqual([{ _id: "e1" }]);
        });
    });

    describe("findUserIdsBySearchTerm", () => {
        it("should search names including deleted users and emails case-insensitively, including deleted users", async () => {
            findUsersByName.mockResolvedValue([]);
            mockQuery.lean.mockResolvedValue([]);

            await repository.findUserIdsBySearchTerm("jane");

            expect(findUsersByName).toHaveBeenCalledWith("jane", { includeDeleted: true });
            expect(User.find).toHaveBeenCalledWith(
                { email: { $regex: "jane", $options: "i" } },
                null,
                { ignoreIsDeleted: true },
            );
            expect(mockQuery.select).toHaveBeenCalledWith("_id");
        });

        it("should escape regex characters so an email search cannot become a pattern", async () => {
            findUsersByName.mockResolvedValue([]);
            mockQuery.lean.mockResolvedValue([]);

            await repository.findUserIdsBySearchTerm("a.b+c@x.com");

            expect(User.find.mock.calls[0][0].email.$regex).toBe("a\\.b\\+c@x\\.com");
        });

        it("should merge name and email matches and list each user only once", async () => {
            findUsersByName.mockResolvedValue([{ _id: "id_1" }, { _id: "id_2" }]);
            mockQuery.lean.mockResolvedValue([{ _id: "id_2" }, { _id: "id_3" }]);

            const ids = await repository.findUserIdsBySearchTerm("jane");

            expect(ids).toHaveLength(3);
            expect(ids).toEqual(expect.arrayContaining(["id_1", "id_2", "id_3"]));
        });

        it("should return no ids when nobody matches", async () => {
            findUsersByName.mockResolvedValue([]);
            mockQuery.lean.mockResolvedValue([]);
            await expect(repository.findUserIdsBySearchTerm("zzz")).resolves.toEqual([]);
        });
    });
});
