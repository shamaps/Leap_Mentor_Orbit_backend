/**
 * @fileoverview Unit tests for Register Service.
 * Secures 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("bcryptjs", () => ({
    hash: jest.fn().mockResolvedValue("mocked_crypto_password_hash"),
}));

jest.mock("../../../utils/auth.utils", () => ({
    issueTokens: jest.fn().mockResolvedValue("mock_session_access_jwt_envelope"),
    validateRoles: jest.fn(),
}));

jest.mock("../../../utils/wallet", () => ({
    provisionWallet: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../../utils/mappers/user.mapper", () => ({
    toUserDTO: jest.fn((user) => ({ id: user._id, email: user.email })),
}));

const createRegisterService = require("../../../services/register.service");
const bcrypt = require("bcryptjs");
const { issueTokens, validateRoles } = require("../../../utils/auth.utils");
const { provisionWallet } = require("../../../utils/wallet");
const AppError = require("../../../utils/appError");

describe("Register Onboarding Service Layer (100% Complete Condition Branch Matrix)", () => {
    let registerRepo, mockLogger, mockResponse, service, defaultIntakeBody;

    beforeEach(() => {
        registerRepo = {
            findUserByEmail: jest.fn(),
            saveUser: jest.fn(),
            createUser: jest.fn(),
            findWalletByUserAndRole: jest.fn(),
            createWallet: jest.fn(),
            createTransaction: jest.fn(),
        };

        mockLogger = { info: jest.fn(), error: jest.fn() };
        mockResponse = { cookie: jest.fn() };
        service = createRegisterService(registerRepo, { logger: mockLogger });

        defaultIntakeBody = {
            name: "Samuel Zaleta",
            email: "samuel@zaleta.com",
            password: "SecurePlaintextPassword2026",
            roles: ["mentee"],
            termsAccepted: true
        };

        jest.clearAllMocks();
    });

    describe("Input Short-Circuit Validations Matrix", () => {
        it("should throw an error if the roles collection size does not equal exactly 1", async () => {
            await expect(service.register(mockResponse, { ...defaultIntakeBody, roles: ["mentor", "mentee"] }))
                .rejects.toThrow(new AppError(400, "Exactly one role is required."));

            await expect(service.register(mockResponse, { ...defaultIntakeBody, roles: [] }))
                .rejects.toThrow(new AppError(400, "Exactly one role is required."));
        });

        it("should throw an error if mandatory fields properties evaluate completely empty", async () => {
            await expect(service.register(mockResponse, { ...defaultIntakeBody, name: "" }))
                .rejects.toThrow(new AppError(400, "name, email, password are required"));
        });

        it("should throw an error if termsAccepted is unaccepted or false", async () => {
            await expect(service.register(mockResponse, { ...defaultIntakeBody, termsAccepted: false }))
                .rejects.toThrow(new AppError(400, "You must accept terms to continue"));
        });

        it("should throw an error if the validated roles fail structural checks layers", async () => {
            validateRoles.mockReturnValue({ valid: false, message: "Role token type not supported" });
            await expect(service.register(mockResponse, defaultIntakeBody))
                .rejects.toThrow(new AppError(400, "Role token type not supported"));
        });
    });

    describe("Collision Handling and Merging Matrix", () => {
        it("should discover missing additions capabilities roles and expand existing profiles before triggering duplicate login exceptions", async () => {
            validateRoles.mockReturnValue({ valid: true, uniqueRoles: ["mentor"] });

            const existingUserMock = { _id: "user_ex_50", roles: ["mentee"] };
            registerRepo.findUserByEmail.mockResolvedValue(existingUserMock);
            registerRepo.findWalletByUserAndRole.mockResolvedValue(null);

            await expect(service.register(mockResponse, defaultIntakeBody))
                .rejects.toThrow(new AppError(400, "This email is already registered. Please login instead."));

            expect(registerRepo.saveUser).toHaveBeenCalledWith(expect.objectContaining({
                roles: ["mentee", "mentor"]
            }));
            expect(provisionWallet).toHaveBeenCalledWith("user_ex_50", "mentor");
        });

        it("should bypass roles mutations altogether if the requested capabilities are duplicates of the existing row", async () => {
            validateRoles.mockReturnValue({ valid: true, uniqueRoles: ["mentee"] });
            const existingUserMock = { _id: "user_ex_55", roles: ["mentee"] };

            
            registerRepo.findUserByEmail.mockResolvedValue(existingUserMock);

            await expect(service.register(mockResponse, defaultIntakeBody))
                .rejects.toThrow(new AppError(400, "This email is already registered. Please login instead."));

            expect(registerRepo.saveUser).not.toHaveBeenCalled();
        });
    });

    describe("Fresh Account Insertions Pipelines", () => {
        it("should hash plain values passwords, provision financial wallets layers, and return valid JWT envelopes upon success", async () => {
            validateRoles.mockReturnValue({ valid: true, uniqueRoles: ["mentee"] });

            
            registerRepo.findUserByEmail.mockResolvedValue(null);
            registerRepo.createUser.mockResolvedValue({ _id: "new_uid_99", email: "samuel@zaleta.com" });

            const res = await service.register(mockResponse, defaultIntakeBody);

            expect(res.message).toBe("Registered successfully");
            expect(bcrypt.hash).toHaveBeenCalledWith("SecurePlaintextPassword2026", 10);
            expect(provisionWallet).toHaveBeenCalledWith("new_uid_99", "mentee");
            expect(res.accessToken).toBe("mock_session_access_jwt_envelope");
            expect(res.isNewUser).toBe(true);
        });
    });
});