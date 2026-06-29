jest.mock("bcryptjs", () => ({
    hash: jest.fn((plain) => Promise.resolve(`hashed_${plain}`)),
    compare: jest.fn((plain, hash) => Promise.resolve(hash === `hashed_${plain}`)),
}));

jest.mock("../../../utils/mailer", () => ({
    sendMail: jest.fn().mockResolvedValue({}),
}));

jest.mock("../../../utils/auth.utils", () => ({
    makeOtp: jest.fn().mockReturnValue("777777"),
}));

jest.mock("../../../config/env", () => ({
    fromEmail: "no-reply@leapmentor.com",
}));

const createForgotPasswordService = require("../../../services/forgotPassword.service");
const bcrypt = require("bcryptjs");
const transporter = require("../../../utils/mailer");

describe("Forgot Password Service (Unit)", () => {
    let mockRepo, mockLogger, service;

    beforeEach(() => {
        mockRepo = {
            findUserByEmail: jest.fn(),
            saveUser: jest.fn(),
            findTokenByUser: jest.fn(),
            deleteTokensByUser: jest.fn(),
            createToken: jest.fn(),
            saveToken: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createForgotPasswordService(mockRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    describe("sendForgotPasswordOTP", () => {
        it("should gracefully short-circuit without creating tokens if the target email is unmapped", async () => {
            mockRepo.findUserByEmail.mockResolvedValue(null);

            await service.sendForgotPasswordOTP("nonexistent@test.com");

            expect(mockRepo.deleteTokensByUser).not.toHaveBeenCalled();
            expect(mockRepo.createToken).not.toHaveBeenCalled();
            expect(transporter.sendMail).not.toHaveBeenCalled();
        });

        it("should purge active verification blocks, hash codes, and issue a recovery email if the account exists", async () => {
            const mockUser = { _id: "user_abc", email: "user@test.com" };
            mockRepo.findUserByEmail.mockResolvedValue(mockUser);

            await service.sendForgotPasswordOTP(" USER@TEST.COM ");

            expect(mockRepo.findUserByEmail).toHaveBeenCalledWith("user@test.com");
            expect(mockRepo.deleteTokensByUser).toHaveBeenCalledWith("user_abc");
            expect(mockRepo.createToken).toHaveBeenCalledWith(expect.objectContaining({
                userId: "user_abc",
                otpHash: "hashed_777777",
            }));
            expect(transporter.sendMail).toHaveBeenCalled();
        });
    });

    describe("verifyResetOTP", () => {
        it("should throw AppError 400 if verification bounds show the token lifespan has expired", async () => {
            mockRepo.findUserByEmail.mockResolvedValue({ _id: "u1" });
            mockRepo.findTokenByUser.mockResolvedValue({ otp: "hashed_123", expiresAt: new Date(Date.now() - 1000) });

            await expect(service.verifyResetOTP({ email: "user@test.com", otp: "123" }))
                .rejects.toMatchObject({ status: 400, message: "OTP expired. Please request a new one." });
            expect(mockRepo.deleteTokensByUser).toHaveBeenCalledWith("u1");
        });

        it("should throw AppError 400 if crypto checksum comparisons mismatch structural values", async () => {
            mockRepo.findUserByEmail.mockResolvedValue({ _id: "u1" });
            mockRepo.findTokenByUser.mockResolvedValue({ otp: "hashed_123", expiresAt: new Date(Date.now() + 60000) });

            await expect(service.verifyResetOTP({ email: "user@test.com", otp: "wrong_otp" }))
                .rejects.toMatchObject({ status: 400, message: "Invalid OTP" });
        });

        it("should extend lifespans and commit updates upon valid matches", async () => {
            mockRepo.findUserByEmail.mockResolvedValue({ _id: "u1" });
            const mockRecord = { otp: "hashed_123", expiresAt: new Date(Date.now() + 60000), save: jest.fn() };
            mockRepo.findTokenByUser.mockResolvedValue(mockRecord);
            mockRepo.saveToken.mockImplementation((rec) => rec.save());

            const result = await service.verifyResetOTP({ email: "user@test.com", otp: "123" });

            expect(result).toBe("user@test.com");
            expect(mockRepo.saveToken).toHaveBeenCalled();
        });
    });

    describe("resetPassword", () => {
        it("should reject changes if the string payload sizes fall below floor limits", async () => {
            await expect(service.resetPassword({ email: "a@a.com", otp: "1", newPassword: "123" }))
                .rejects.toMatchObject({ status: 400, message: "Password must be at least 6 characters" });
        });

        it("should overwrite persistent properties, hash variables, and clear tokens upon validation checkpoints", async () => {
            const mockUser = { _id: "u1", password: "old" };
            mockRepo.findUserByEmail.mockResolvedValue(mockUser);
            mockRepo.findTokenByUser.mockResolvedValue({ otp: "hashed_123", expiresAt: new Date(Date.now() + 60000) });

            await service.resetPassword({ email: "user@test.com", otp: "123", newPassword: "fresh_password" });

            expect(mockUser.password).toBe("hashed_fresh_password");
            expect(mockRepo.saveUser).toHaveBeenCalledWith(mockUser);
            expect(mockRepo.deleteTokensByUser).toHaveBeenCalledWith("u1");
        });
    });
});