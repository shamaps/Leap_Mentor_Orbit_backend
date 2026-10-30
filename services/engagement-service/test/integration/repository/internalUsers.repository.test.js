/**
 * @fileoverview Tests for the Internal Users Repository.
 * The ConnectRequest model is mocked, so these check the exact queries built.
 */

jest.mock("@leapmentor/shared/models/ConnectRequest", () => ({
    deleteMany: jest.fn(),
    updateMany: jest.fn(),
}));

const ConnectRequest = require("@leapmentor/shared/models/ConnectRequest");
const repository = require("../../../src/repositories/internalUsers.repository");

describe("Internal Users Repository", () => {
    beforeEach(() => jest.clearAllMocks());

    describe("deleteRequestsForUser", () => {
        it("should delete every request where the user is the mentor or the mentee", async () => {
            ConnectRequest.deleteMany.mockResolvedValue({ deletedCount: 4 });

            const result = await repository.deleteRequestsForUser("user_1");

            expect(ConnectRequest.deleteMany).toHaveBeenCalledWith({ $or: [{ mentor: "user_1" }, { mentee: "user_1" }] });
            expect(result).toEqual({ requests: 4 });
        });

        it("should report zero when the driver gives no count", async () => {
            ConnectRequest.deleteMany.mockResolvedValue({});
            await expect(repository.deleteRequestsForUser("user_1")).resolves.toEqual({ requests: 0 });
        });
    });

    describe("cancelPendingRequestsForUser", () => {
        it("should mark only the user's pending requests as cancelled and deleted", async () => {
            const now = new Date("2026-05-01T10:00:00Z");
            ConnectRequest.updateMany.mockResolvedValue({ modifiedCount: 2 });

            const result = await repository.cancelPendingRequestsForUser("user_1", now);

            expect(ConnectRequest.updateMany).toHaveBeenCalledWith(
                { $or: [{ mentor: "user_1" }, { mentee: "user_1" }], status: "pending" },
                { $set: { isDeleted: true, deletedAt: now, status: "cancelled" } },
            );
            expect(result).toEqual({ requests: 2 });
        });

        it("should leave accepted, ongoing and completed requests out of the update", async () => {
            ConnectRequest.updateMany.mockResolvedValue({ modifiedCount: 0 });

            await repository.cancelPendingRequestsForUser("user_1");

            const filter = ConnectRequest.updateMany.mock.calls[0][0];
            expect(filter.status).toBe("pending"); // money or history may be attached to the others
        });

        it("should use the current time when none is given", async () => {
            ConnectRequest.updateMany.mockResolvedValue({ modifiedCount: 1 });
            const before = Date.now();

            await repository.cancelPendingRequestsForUser("user_1");

            const { deletedAt } = ConnectRequest.updateMany.mock.calls[0][1].$set;
            expect(deletedAt).toBeInstanceOf(Date);
            expect(deletedAt.getTime()).toBeGreaterThanOrEqual(before);
        });

        it("should report zero when the driver gives no count", async () => {
            ConnectRequest.updateMany.mockResolvedValue({});
            await expect(repository.cancelPendingRequestsForUser("user_1")).resolves.toEqual({ requests: 0 });
        });
    });
});
