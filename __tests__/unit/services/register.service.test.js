jest.mock("bcryptjs", () => ({
    hash: jest.fn(() => Promise.resolve("hashed_password_string")),
}));

jest.mock("../../../utils/auth.utils", () => ({
    issueTokens: jest.fn(() => Promise.resolve("mock_signed_jwt")),
    validateRoles: jest.fn((roles) => ({ valid: true, message: "", uniqueRoles: roles })),
}));

jest.mock("../../../utils/wallet", () => ({
    provisionWallet: jest.fn().mockResolvedValue({}),
}));

jest.mock("../../../utils/mappers/user.mapper", () => ({
    toUserDTO: jest.fn((user) => user),
}));

const createRegisterService = require("../../../services/register.service");
const { validateRoles, issueTokens } = require("../../../utils/auth.utils");
const { provisionWallet } = require("../../../utils/wallet");

describe("Register Service (Unit)", () => {
    let mockRepo, mockLogger, service;

    beforeEach(() => {
        mockRepo = {
            findUserByEmail: jest.fn(),
            saveUser: jest.fn(),
            createUser: jest.fn(),
            findWalletByUserAndRole: jest.fn(),
            createWallet: jest.fn(),
            createTransaction: jest.fn(),
        };
        mockLogger = { info: jest.fn(), error: jest.fn() };
        service = createRegisterService(mockRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    it("should throw AppError 400 if roles do not contain exactly one role choice element", async () => {
        const payload = { name: "A", email: "a@a.com", password: "p", roles: ["mentor", "mentee"], termsAccepted: true };
        await expect(service.register({}, payload))
            .rejects.toMatchObject({ status: 400, message: "Exactly one role is required." });
    });

    it("should throw AppError 400 if compliance terms are unaccepted by the onboarder", async () => {
        const payload = { name: "A", email: "a@a.com", password: "p", roles: ["mentee"], termsAccepted: false };
        await expect(service.register({}, payload))
            .rejects.toMatchObject({ status: 400, message: "You must accept terms to continue" });
    });

    it("should attempt role expansion checks and reject with a 400 status if the email is already configured", async () => {
        const payload = { name: "Alice", email: "alice@test.com", password: "p", roles: ["mentee"], termsAccepted: true };
        const mockUserDoc = { _id: "u123", roles: ["mentee"], save: jest.fn() };

        mockRepo.findUserByEmail.mockResolvedValue(mockUserDoc);

        await expect(service.register({}, payload))
            .rejects.toMatchObject({ status: 400, message: "This email is already registered. Please login instead." });
    });

    it("should hash cleartext passwords, persist user documents, and provision structural wallets on valid registrations", async () => {
        const payload = { name: "  Bob  ", email: " BOB@test.com ", password: "clear_pass", roles: ["mentor"], termsAccepted: true };
        mockRepo.findUserByEmail.mockResolvedValue(null);
        mockRepo.createUser.mockResolvedValue({ _id: "user_bob", name: "Bob", email: "bob@test.com", roles: ["mentor"] });

        const result = await service.register({}, payload);

        expect(mockRepo.findUserByEmail).toHaveBeenCalledWith("bob@test.com");
        expect(mockRepo.createUser).toHaveBeenCalledWith(expect.objectContaining({
            name: "Bob",
            email: "bob@test.com",
            password: "hashed_password_string",
        }));
        expect(provisionWallet).toHaveBeenCalledWith("user_bob", "mentor");
        expect(result.isNewUser).toBe(true);
        expect(result.accessToken).toBe("mock_signed_jwt");
    });
});