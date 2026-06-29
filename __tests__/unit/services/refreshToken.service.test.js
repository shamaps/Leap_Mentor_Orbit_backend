/**
 * @fileoverview Unit tests for RefreshToken Service.
 * Targets 100% complete statement, branch, and condition coverage layers.
 */

jest.mock("../../../utils/auth.utils", () => ({
    signToken: jest.fn().mockReturnValue("new_mock_access_token"),
    setRefreshCookie: jest.fn(),
    getRefreshMs: jest.fn().mockReturnValue(604800000), // 7 days
    generateRefreshToken: jest.fn().mockReturnValue("fresh_plaintext_token_abc"),
}));

jest.mock("../../../utils/mappers/user.mapper", () => ({
    toUserDTO: jest.fn((user) => ({ id: user._id, email: user.email })),
}));

const createRefreshTokenService = require("../../../services/refreshToken.service");
const { signToken, setRefreshCookie, generateRefreshToken } = require("../../../utils/auth.utils");
const AppError = require("../../../utils/appError");

describe("Refresh Token Service (100% Comprehensive Coverage)", () => {
    let mockRepo, mockLogger, service, mockRes;

    beforeEach(() => {
        mockRepo = {
            findByHash: jest.fn(),
            deleteById: jest.fn(),
            deleteByHash: jest.fn(),
            create: jest.fn(),
        };
        mockLogger = { info: jest.fn(), error: jest.fn() };
        mockRes = { cookie: jest.fn() };

        service = createRefreshTokenService(mockRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    describe("refresh", () => {
        it("should throw AppError 401 if rawCookieToken is missing or undefined", async () => {
            await expect(service.refresh(undefined, mockRes))
                .rejects.toMatchObject({ status: 401, message: "No refresh token" });
            expect(mockRepo.findByHash).not.toHaveBeenCalled();
        });

        it("should throw AppError 401 if token hash matches no stored records", async () => {
            mockRepo.findByHash.mockResolvedValue(null);

            await expect(service.refresh("unregistered_token_plaintext", mockRes))
                .rejects.toMatchObject({ status: 401, message: "Refresh token expired or invalid" });
        });

        it("should throw AppError 401 if the stored token has passed its expiration window limit", async () => {
            const expiredTokenDoc = {
                _id: "t_expired",
                expiresAt: new Date(Date.now() - 10000), // explicitly in the past
                user: { _id: "u123", email: "user@test.com" }
            };
            mockRepo.findByHash.mockResolvedValue(expiredTokenDoc);

            await expect(service.refresh("expired_token_plaintext", mockRes))
                .rejects.toMatchObject({ status: 401, message: "Refresh token expired or invalid" });
        });

        it("should successfully rotate tokens, drop the old hash document record, and commit a fresh pair", async () => {
            const validTokenDoc = {
                _id: "t_valid",
                expiresAt: new Date(Date.now() + 60000), // safely in the future
                user: { _id: "u123", email: "user@test.com" }
            };
            mockRepo.findByHash.mockResolvedValue(validTokenDoc);
            mockRepo.deleteById.mockResolvedValue({ deletedCount: 1 });
            mockRepo.create.mockResolvedValue({ _id: "t_new" });

            const result = await service.refresh("valid_plaintext_token", mockRes);

            // Verify old token cleanup side-effect pass
            expect(mockRepo.deleteById).toHaveBeenCalledWith("t_valid");

            // Verify new tracking signature row gets written back
            expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                userId: "u123",
                tokenHash: expect.any(String),
                expiresAt: expect.any(Date)
            }));

            // Verify utility and cookie dispatches
            expect(setRefreshCookie).toHaveBeenCalledWith(mockRes, "fresh_plaintext_token_abc");
            expect(result).toEqual({
                accessToken: "new_mock_access_token",
                user: { id: "u123", email: "user@test.com" }
            });
        });
    });

    describe("logout", () => {
        it("should execute repository deletions by hash signature if cookie variables exist", async () => {
            mockRepo.deleteByHash.mockResolvedValue({ deletedCount: 1 });

            const result = await service.logout("active_cookie_token_string");

            expect(mockRepo.deleteByHash).toHaveBeenCalledWith(expect.any(String));
            expect(result).toEqual({ message: "Logged out successfully" });
        });

        it("should skip repository eviction calls gracefully if rawCookieToken arrives unassigned or empty", async () => {
            const result = await service.logout(undefined);

            expect(mockRepo.deleteByHash).not.toHaveBeenCalled();
            expect(result).toEqual({ message: "Logged out successfully" });
        });
    });
});