jest.mock("bcryptjs", () => ({
    hash: jest.fn(() => Promise.resolve("mocked_hashed_token")),
    compare: jest.fn(),
}));

jest.mock("../../../utils/mailer", () => ({
    sendMail: jest.fn(() => Promise.resolve({ messageId: "mock_id" })),
}));

jest.mock("../../../utils/auth.utils", () => ({
    makeOtp: jest.fn(() => "123456"),
}));

jest.mock("../../../config/env", () => ({
    appBaseUrl: "https://sandbox.leapmentor.com",
    fromEmail: "noreply@leapmentor.com",
}));

const createVerificationService = require("../../../services/verification.service");
const transporter = require("../../../utils/mailer");
const bcrypt = require("bcryptjs");
const AppError = require("../../../utils/appError");

describe("Verification Service (Complete Unit Coverage)", () => {
    let mockRepo, mockLogger, service, mockUser;

    beforeEach(() => {
        mockRepo = {
            findUserByEmail: jest.fn(),
            markEmailVerified: jest.fn(),
            deleteTokensByUser: jest.fn(),
            createVerificationToken: jest.fn(),
            findTokenByUser: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createVerificationService(mockRepo, { logger: mockLogger });

        mockUser = { _id: "user_id_111", email: "onboard@test.com", isEmailVerified: false, role: "mentee" };
        jest.clearAllMocks();
    });

    describe("sendVerification", () => {
        it("should clear historical codes, create fresh secure hashes, and dispatch verification emails", async () => {
            mockRepo.findUserByEmail.mockResolvedValue(mockUser);
            mockRepo.deleteTokensByUser.mockResolvedValue({});
            mockRepo.createVerificationToken.mockResolvedValue({});

            const result = await service.sendVerification({ email: "onboard@test.com" });

            expect(mockRepo.deleteTokensByUser).toHaveBeenCalledWith("user_id_111");
            expect(mockRepo.createVerificationToken).toHaveBeenCalledWith(expect.objectContaining({
                user: "user_id_111",
                otp: "mocked_hashed_token",
            }));
            expect(transporter.sendMail).toHaveBeenCalled();
            expect(result.status).toBe(200);
        });

        it("should block requests and return status 400 if user account data points flag verified states", async () => {
            mockUser.isEmailVerified = true;
            mockRepo.findUserByEmail.mockResolvedValue(mockUser);

            const result = await service.sendVerification({ email: "onboard@test.com" });

            expect(result.status).toBe(400);
            expect(result.body.message).toBe("Email is already verified");
            expect(transporter.sendMail).not.toHaveBeenCalled();
        });
    });

    describe("verifyOtp", () => {
        it("should return status 400 immediately if verification codes pass expiration parameters bounds", async () => {
            mockRepo.findUserByEmail.mockResolvedValue(mockUser);
            mockRepo.findTokenByUser.mockResolvedValue({ expiresAt: new Date(Date.now() - 5000) });

            const result = await service.verifyOtp({ email: "onboard@test.com", otp: "123456" });

            expect(result.status).toBe(400);
            expect(result.body.message).toContain("OTP expired");
            expect(mockRepo.deleteTokensByUser).toHaveBeenCalledWith("user_id_111");
        });

        it("should validate raw values against stored token hashes and set email flag states verified on clean matches", async () => {
            mockRepo.findUserByEmail.mockResolvedValue(mockUser);
            mockRepo.findTokenByUser.mockResolvedValue({ expiresAt: new Date(Date.now() + 60000), otp: "hashed_otp_val" });
            bcrypt.compare.mockResolvedValue(true);

            const result = await service.verifyOtp({ email: "onboard@test.com", otp: "123456" });

            expect(bcrypt.compare).toHaveBeenCalledWith("123456", "hashed_otp_val");
            expect(mockRepo.markEmailVerified).toHaveBeenCalledWith(mockUser);
            expect(mockRepo.deleteTokensByUser).toHaveBeenCalledWith("user_id_111");
            expect(result.status).toBe(200);
        });
    });

    describe("resendVerification", () => {
        it("should return status 404 if trying to issue resend commands on a missing user record", async () => {
            mockRepo.findUserByEmail.mockResolvedValue(null);

            const result = await service.resendVerification({ email: "missing@test.com" });

            expect(result.status).toBe(404);
            expect(result.body.message).toBe("User not found");
        });
    });

    describe("verifyLink", () => {
        it("should reject token parameter confirmations with status 400 if no request context records match", async () => {
            mockRepo.findUserByEmail.mockResolvedValue(mockUser);
            mockRepo.findTokenByUser.mockResolvedValue(null);

            const result = await service.verifyLink({ token: "hex_token", email: "onboard@test.com" });

            expect(result.status).toBe(400);
            expect(result.body.message).toBe("No verification request found");
        });
    });
});