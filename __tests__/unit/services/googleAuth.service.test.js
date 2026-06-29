/**
 * @fileoverview Unit tests for Google Auth Service.
 * Secures 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("jsonwebtoken", () => ({
    decode: jest.fn(),
}));

jest.mock("../../../utils/auth.utils", () => ({
    googleClient: {
        verifyIdToken: jest.fn(),
    },
    validateRoles: jest.fn(),
    mergeRoles: jest.fn(),
}));

jest.mock("../../../utils/wallet", () => ({
    provisionWallet: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../../utils/withTimeout", () => ({
    withTimeout: jest.fn((promise) => promise),
}));

jest.mock("../../../utils/mappers/user.mapper", () => ({
    toUserDTO: jest.fn((user) => ({ id: user._id, email: user.email })),
}));

jest.mock("../../../config/env", () => ({
    googleClientId: "mock_client_id_123",
}));

const createGoogleAuthService = require("../../../services/googleAuth.service");
const jwt = require("jsonwebtoken");
const { googleClient, validateRoles, mergeRoles } = require("../../../utils/auth.utils");
const { provisionWallet } = require("../../../utils/wallet");
const config = require("../../../config/env");
const AppError = require("../../../utils/appError");

describe("Google Auth Service Layer (100% Condition Coverage Blueprint)", () => {
    let mockRepo, mockLogger, service, defaultPayload;

    beforeEach(() => {
        mockRepo = {
            findUserByEmail: jest.fn(),
            createUser: jest.fn(),
            saveUser: jest.fn(),
            findOAuthAccount: jest.fn(),
            createOAuthAccount: jest.fn(),
        };

        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createGoogleAuthService(mockRepo, { logger: mockLogger });

        defaultPayload = {
            credential: "valid_raw_google_jwt_token",
            roles: ["mentee"],
            termsAccepted: true,
        };

        config.googleClientId = "mock_client_id_123";
        jest.clearAllMocks();
    });

    it("should throw a 400 error if the raw credential parameter is missing", async () => {
        await expect(service.googleAuth({ ...defaultPayload, credential: null }))
            .rejects.toThrow(new AppError(400, "Missing Google credential"));
    });

    it("should throw a 500 error if GOOGLE_CLIENT_ID configuration is absent from the environment", async () => {
        config.googleClientId = "";
        jwt.decode.mockReturnValue({ aud: "any" });

        await expect(service.googleAuth(defaultPayload))
            .rejects.toThrow(new AppError(500, "GOOGLE_CLIENT_ID is undefined in .env"));
    });

    it("should issue a telemetry warning if the token audience field mismatches the application client ID configuration", async () => {
        jwt.decode.mockReturnValue({ aud: "mismatch_client_id" });
        googleClient.verifyIdToken.mockResolvedValue({
            getPayload: () => ({
                aud: "mismatch_client_id",
                email: "test@user.com",
                sub: "google_sub_123",
                email_verified: true,
                name: "Test User"
            })
        });
        mockRepo.findUserByEmail.mockResolvedValue({ _id: "u1", email: "test@user.com" });
        mockRepo.findOAuthAccount.mockResolvedValue({ id: "oauth_id" });

        await service.googleAuth(defaultPayload);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("issued for a different Client ID"));
    });

    it("should throw a 400 error if email or unique provider identifiers are missing from the payload", async () => {
        jwt.decode.mockReturnValue({ aud: "mock_client_id_123" });
        googleClient.verifyIdToken.mockResolvedValue({
            getPayload: () => ({ aud: "mock_client_id_123", email: "", sub: null })
        });

        await expect(service.googleAuth(defaultPayload))
            .rejects.toThrow(new AppError(400, "Invalid Google payload (missing email/sub)"));
    });

    it("should merge capability structures if an existing user matches the verified identity claims", async () => {
        jwt.decode.mockReturnValue({ aud: "mock_client_id_123" });
        googleClient.verifyIdToken.mockResolvedValue({
            getPayload: () => ({ aud: "mock_client_id_123", email: "EXISTING@user.com", sub: "gsub", name: "User" })
        });
        const existingUser = { _id: "ex_user_77", email: "existing@user.com" };
        mockRepo.findUserByEmail.mockResolvedValue(existingUser);
        mockRepo.findOAuthAccount.mockResolvedValue(null); // Triggers ensureOAuthAccount creation path

        const res = await service.googleAuth(defaultPayload);

        expect(mergeRoles).toHaveBeenCalledWith(existingUser, ["mentee"], mockRepo.saveUser);
        expect(mockRepo.createOAuthAccount).toHaveBeenCalledWith("ex_user_77", "google", "gsub");
        expect(res.isNewUser).toBe(false);
    });

    it("should throw a 400 error during registration fallback routes if compliance policies are unaccepted", async () => {
        jwt.decode.mockReturnValue({ aud: "mock_client_id_123" });
        googleClient.verifyIdToken.mockResolvedValue({
            getPayload: () => ({ aud: "mock_client_id_123", email: "new@user.com", sub: "gsub" })
        });
        mockRepo.findUserByEmail.mockResolvedValue(null);

        await expect(service.googleAuth({ ...defaultPayload, termsAccepted: false }))
            .rejects.toThrow(new AppError(400, "You must accept terms to continue"));
    });

    it("should default roles collection parameters and support raw array mappings on brand-new profiles creation", async () => {
        jwt.decode.mockReturnValue({ aud: "mock_client_id_123" });
        googleClient.verifyIdToken.mockResolvedValue({
            getPayload: () => ({ aud: "mock_client_id_123", email: "new@user.com", sub: "gsub", email_verified: true })
        });
        mockRepo.findUserByEmail.mockResolvedValue(null);
        validateRoles.mockReturnValue({ valid: true, uniqueRoles: ["mentee"] });
        mockRepo.createUser.mockResolvedValue({ _id: "new_uid", email: "new@user.com" });
        mockRepo.findOAuthAccount.mockResolvedValue({ exists: true });

        const res = await service.googleAuth({ ...defaultPayload, roles: null }); // Forces incomingRoles fallback line evaluation

        expect(validateRoles).toHaveBeenCalledWith(["mentee"]);
        expect(provisionWallet).toHaveBeenCalledWith("new_uid", ["mentee"]);
        expect(res.isNewUser).toBe(true);
    });

    it("should throw a 400 error if initial creation roles parameters fail downstream validation layers", async () => {
        jwt.decode.mockReturnValue({ aud: "mock_client_id_123" });
        googleClient.verifyIdToken.mockResolvedValue({
            getPayload: () => ({ aud: "mock_client_id_123", email: "new@user.com", sub: "gsub" })
        });
        mockRepo.findUserByEmail.mockResolvedValue(null);
        validateRoles.mockReturnValue({ valid: false, message: "Invalid role selection configuration options" });

        await expect(service.googleAuth(defaultPayload))
            .rejects.toThrow(new AppError(400, "Invalid role selection configuration options"));
    });
});