/**
 * @fileoverview Unit tests for the Internal Users Service.
 * Identity calls these through the user lifecycle endpoints when an account is deleted.
 */

const createInternalUsersService = require("../../../src/services/internalUsers.service");

describe("Internal Users Service", () => {
    let repo, logger, service;

    beforeEach(() => {
        repo = {
            deleteRequestsForUser: jest.fn().mockResolvedValue({ requests: 3 }),
            cancelPendingRequestsForUser: jest.fn().mockResolvedValue({ requests: 1 }),
        };
        logger = { info: jest.fn() };
        service = createInternalUsersService(repo, { logger });
    });

    describe("hardDelete", () => {
        it("should delete the user's requests and report how many", async () => {
            await expect(service.hardDelete("user_1")).resolves.toEqual({ requests: 3 });
            expect(repo.deleteRequestsForUser).toHaveBeenCalledWith("user_1");
        });

        it("should log the user id as text together with the counts", async () => {
            await service.hardDelete({ toString: () => "oid_1" , valueOf: () => "oid_1" });
            expect(logger.info).toHaveBeenCalledWith(
                "Connect requests deleted for user",
                expect.objectContaining({ requests: 3 }),
            );
        });

        it("should propagate a repository failure", async () => {
            repo.deleteRequestsForUser.mockRejectedValue(new Error("db down"));
            await expect(service.hardDelete("user_1")).rejects.toThrow("db down");
        });
    });

    describe("softDelete", () => {
        it("should cancel the user's pending requests and report how many", async () => {
            await expect(service.softDelete("user_1")).resolves.toEqual({ requests: 1 });
            expect(repo.cancelPendingRequestsForUser).toHaveBeenCalledWith("user_1");
            expect(logger.info).toHaveBeenCalledWith(
                "Pending connect requests cancelled for user",
                { userId: "user_1", requests: 1 },
            );
        });

        it("should propagate a repository failure", async () => {
            repo.cancelPendingRequestsForUser.mockRejectedValue(new Error("db down"));
            await expect(service.softDelete("user_1")).rejects.toThrow("db down");
        });
    });

    it("should not expose a restore operation (pending requests are not brought back)", () => {
        expect(service.restore).toBeUndefined();
    });

    it("should work without a logger", async () => {
        service = createInternalUsersService(repo);
        await expect(service.hardDelete("user_1")).resolves.toEqual({ requests: 3 });
        await expect(service.softDelete("user_1")).resolves.toEqual({ requests: 1 });
    });
});
