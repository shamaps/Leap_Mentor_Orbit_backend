/**
 * @fileoverview Unit tests for RefreshToken Repository.
 * Reaches 100% complete statement, branch, and error catch path coverage.
 */

// Mock the Mongoose Model dependencies completely
jest.mock("../../../models/RefreshToken", () => ({
    findOne: jest.fn(),
    deleteOne: jest.fn(),
    create: jest.fn(),
}));

// Mock the winston telemetry diagnostic logger utility
jest.mock("../../../utils/logger", () => ({
    error: jest.fn(),
}));

const RefreshToken = require("../../../models/RefreshToken");
const logger = require("../../../utils/logger");
const repository = require("../../../repositories/refreshToken.repository");

describe("RefreshToken Repository (100% Coverage Suite)", () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("findByHash", () => {
        it("should successfully locate a token hash and invoke populated user profiles chain", async () => {
            const mockPopulate = jest.fn().mockResolvedValue({ tokenHash: "abc", user: { _id: "u1" } });
            RefreshToken.findOne.mockReturnValue({ populate: mockPopulate });

            const result = await repository.findByHash("abc");

            expect(RefreshToken.findOne).toHaveBeenCalledWith({ tokenHash: "abc" });
            expect(mockPopulate).toHaveBeenCalledWith("user", "_id email roles isEmailVerified isDeleted");
            expect(result).toEqual({ tokenHash: "abc", user: { _id: "u1" } });
        });

        it("should log the exception and rethrow the database error when findOne rejects", async () => {
            const dbError = new Error("Connection Timeout");
            RefreshToken.findOne.mockReturnValue({
                populate: jest.fn().mockRejectedValue(dbError)
            });

            await expect(repository.findByHash("abc")).rejects.toThrow("Connection Timeout");
            expect(logger.error).toHaveBeenCalledWith("DB error in findByHash", { error: "Connection Timeout" });
        });
    });

    describe("deleteById", () => {
        it("should target and delete records by primary database key identifiers", async () => {
            const mockResult = { deletedCount: 1 };
            RefreshToken.deleteOne.mockResolvedValue(mockResult);

            const result = await repository.deleteById("id_123");

            expect(RefreshToken.deleteOne).toHaveBeenCalledWith({ _id: "id_123" });
            expect(result).toEqual(mockResult);
        });

        it("should log the exception and rethrow the database error when deleteById rejects", async () => {
            const dbError = new Error("Write Lock Timeout");
            RefreshToken.deleteOne.mockRejectedValue(dbError);

            await expect(repository.deleteById("id_123")).rejects.toThrow("Write Lock Timeout");
            expect(logger.error).toHaveBeenCalledWith("DB error in deleteById", { error: "Write Lock Timeout" });
        });
    });

    describe("deleteByHash", () => {
        it("should delete tokens cleanly matching standard cryptographic hash strings", async () => {
            const mockResult = { deletedCount: 1 };
            RefreshToken.deleteOne.mockResolvedValue(mockResult);

            const result = await repository.deleteByHash("hash_xyz");

            expect(RefreshToken.deleteOne).toHaveBeenCalledWith({ tokenHash: "hash_xyz" });
            expect(result).toEqual(mockResult);
        });

        it("should log the exception and rethrow the database error when deleteByHash rejects", async () => {
            const dbError = new Error("Cluster Disconnected");
            RefreshToken.deleteOne.mockRejectedValue(dbError);

            await expect(repository.deleteByHash("hash_xyz")).rejects.toThrow("Cluster Disconnected");
            expect(logger.error).toHaveBeenCalledWith("DB error in deleteByHash", { error: "Cluster Disconnected" });
        });
    });

    describe("create", () => {
        it("should create a fresh collection record model row following criteria bounds mapping", async () => {
            const mockDoc = { user: "u1", tokenHash: "hash", expiresAt: "2026-07-01" };
            RefreshToken.create.mockResolvedValue(mockDoc);

            const payload = { userId: "u1", tokenHash: "hash", expiresAt: "2026-07-01" };
            const result = await repository.create(payload);

            expect(RefreshToken.create).toHaveBeenCalledWith({ user: "u1", tokenHash: "hash", expiresAt: "2026-07-01" });
            expect(result).toEqual(mockDoc);
        });

        it("should log the exception and rethrow operational storage errors when write actions drop", async () => {
            const dbError = new Error("Validation Constraints Violated");
            RefreshToken.create.mockRejectedValue(dbError);

            const payload = { userId: "u1", tokenHash: "hash", expiresAt: "2026-07-01" };
            await expect(repository.create(payload)).rejects.toThrow("Validation Constraints Violated");
            expect(logger.error).toHaveBeenCalledWith("DB error in create (refreshToken)", { error: "Validation Constraints Violated" });
        });
    });
});