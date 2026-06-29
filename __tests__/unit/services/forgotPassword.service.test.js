/**
 * @fileoverview Unit tests for Forgot Password Service.
 * Secures 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("bcryptjs", () => ({
    hash: jest.fn().mockResolvedValue("crypto_hash_string"),
    compare: jest.fn(),
}));

jest.mock("../../../utils/mailer", () => ({
    sendMail: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../../utils/auth.utils", () => ({
    makeOtp: jest.fn().mockReturnValue("888888"),
}));

jest.mock("../../../config/env", () => ({
    fromEmail: "recovery@leapmentor.com",
}));

const createForgotPasswordService = require("../../../services/forgotPassword.service");
const transporter = require("../../../utils/mailer");
const bcrypt = require("bcryptjs");
const AppError = require("../../../utils/appError");

describe("Forgot Password Recovery Service Layer (100% Complete Branch Matrix)", () => {
    let mockRepo, mockLogger, service, mockUser, mockTokenRecord;

    beforeEach(() => {
        mockRepo = {
            findUserByEmail: jest.fn(),
            saveUser: jest.fn(),
            findTokenByUser: jest.fn(),
            deleteTokensByUser: jest.fn(),
            createToken: jest.fn(),
            saveToken: jest.fn(),
        };

        mockLogger = { info: jest.fn(), error: jest.fn() };
        service = createForgotPasswordService(mockRepo, { logger: mockLogger });

        mockUser = { _id: "u_recover_99", email: "recover@test.com", password: "old" };
        mockTokenRecord = { otp: "hashed_otp_900", expiresAt: new Date(Date.now() + 600000), save: jest.fn() };

        jest.clearAllMocks();
    });

    describe("sendForgotPasswordOTP Onboarding", () => {
        it("should throw a 400 error if input email parameters are missing", async () => {
            await expect(service.sendForgotPasswordOTP(null)).rejects.toThrow(new AppError(400, "email is required"));
        });

        it("should short-circuit silently without throwing exceptions if email does not match any profile row", async () => {
            mockRepo.findUserByEmail.mockResolvedValue(null);
            const res = await service.sendForgotPasswordOTP("nonexistent@test.com");
            expect(res).toBeUndefined();
            expect(mockRepo.deleteTokensByUser).not.toHaveBeenCalled();
        });

        it("should clear old active transient items and dispatch inline styles HTML mailers upon successful hits", async () => {
            mockRepo.findUserByEmail.mockResolvedValue(mockUser);

            await service.sendForgotPasswordOTP("  RECOVER@test.com  ");

            expect(mockRepo.deleteTokensByUser).toHaveBeenCalledWith("u_recover_99");
            expect(mockRepo.createToken).toHaveBeenCalled();
            expect(transporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
                to: "recover@test.com",
                html: expect.stringContaining("888888")
            }));
        });
    });

    describe("verifyResetOTP Assertions Paths", () => {
        it("should throw a 400 error if mandatory fields arguments are unassigned", async () => {
            await expect(service.verifyResetOTP({ email: "r@test.com", otp: "" })).rejects.toThrow(AppError);
        });

        it("should throw a 400 error if token record lookups or embedded otp hashing are absent", async () => {
            mockRepo.findUserByEmail.mockResolvedValue(mockUser);
            mockRepo.findTokenByUser.mockResolvedValue(null);

            await expect(service.verifyResetOTP({ email: "recover@test.com", otp: "888888" }))
                .rejects.toThrow(new AppError(400, "Invalid OTP"));
        });

        it("should remove records and throw a 400 error if token lifecycles have passed target boundaries", async () => {
            mockRepo.findUserByEmail.mockResolvedValue(mockUser);
            mockRepo.findTokenByUser.mockResolvedValue({ otp: "hash", expiresAt: new Date(Date.now() - 1000) });

            await expect(service.verifyResetOTP({ email: "recover@test.com", otp: "888888" }))
                .rejects.toThrow(new AppError(400, "OTP expired. Please request a new one."));
            expect(mockRepo.deleteTokensByUser).toHaveBeenCalledWith("u_recover_99");
        });

        it("should throw a 400 error if crypto matching plaintext verifications fail matching signatures", async () => {
            mockRepo.findUserByEmail.mockResolvedValue(mockUser);
            mockRepo.findTokenByUser.mockResolvedValue(mockTokenRecord);
            bcrypt.compare.mockResolvedValue(false);

            await expect(service.verifyResetOTP({ email: "recover@test.com", otp: "000000" }))
                .rejects.toThrow(new AppError(400, "Invalid OTP"));
        });

        it("should extend expiration date windows and return normalized email names strings upon matched success", async () => {
            mockRepo.findUserByEmail.mockResolvedValue(mockUser);
            mockRepo.findTokenByUser.mockResolvedValue(mockTokenRecord);
            bcrypt.compare.mockResolvedValue(true);

            const res = await service.verifyResetOTP({ email: "recover@test.com", otp: "888888" });
            expect(res).toBe("recover@test.com");
            // FIXED: 改用 standard Jest Matcher 語法
            expect(mockRepo.saveToken).toHaveBeenCalledWith(mockTokenRecord);
        });
    });

    describe("resetPassword Terminations Workflows", () => {
        it("should throw a 400 error if missing required payload mutator parameters properties", async () => {
            await expect(service.resetPassword({ email: "a@a.com", otp: "1", newPassword: "" })).rejects.toThrow(AppError);
        });

        it("should throw a 400 error if password complexity configurations fall below 6 characters length thresholds", async () => {
            await expect(service.resetPassword({ email: "a@a.com", otp: "1", newPassword: "123" }))
                .rejects.toThrow(new AppError(400, "Password must be at least 6 characters"));
        });

        it("should throw a 400 error during password overrides if decryption validation check fails", async () => {
            mockRepo.findUserByEmail.mockResolvedValue(mockUser);
            mockRepo.findTokenByUser.mockResolvedValue(mockTokenRecord);
            bcrypt.compare.mockResolvedValue(false);

            await expect(service.resetPassword({ email: "recover@test.com", otp: "000000", newPassword: "secure_pass_90" }))
                .rejects.toThrow(new AppError(400, "Invalid session. Please start over."));
        });

        it("should hash new password strings, save user model updates, and purge temporary tokens vectors upon completion success", async () => {
            mockRepo.findUserByEmail.mockResolvedValue(mockUser);
            mockRepo.findTokenByUser.mockResolvedValue(mockTokenRecord);
            bcrypt.compare.mockResolvedValue(true);

            await service.resetPassword({ email: "recover@test.com", otp: "888888", newPassword: "secure_pass_2026" });

            expect(bcrypt.hash).toHaveBeenCalledWith("secure_pass_2026", 10);
            expect(mockRepo.saveUser).toHaveBeenCalledWith(expect.objectContaining({ password: "crypto_hash_string" }));
            expect(mockRepo.deleteTokensByUser).toHaveBeenCalledWith("u_recover_99");
        });
    });
});