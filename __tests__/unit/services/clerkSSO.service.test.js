jest.mock("jsonwebtoken", () => ({
    decode: jest.fn(),
}));

jest.mock("../../../utils/withRetry", () => ({
    withRetry: jest.fn((fn) => fn()),
}));

jest.mock("../../../utils/auth.utils", () => ({
    clerkClient: {
        users: {
            getUser: jest.fn(),
        },
    },
    validateRoles: jest.fn(),
    mergeRoles: jest.fn(),
}));

jest.mock("../../../utils/wallet", () => ({
    provisionWallet: jest.fn(),
}));

jest.mock("../../../utils/mappers/user.mapper", () => ({
    toUserDTO: jest.fn((user) => user),
}));

const createClerkSSOService = require("../../../services/clerkSSO.service");
const jwt = require("jsonwebtoken");
const { clerkClient, validateRoles, mergeRoles } = require("../../../utils/auth.utils");
const { provisionWallet } = require("../../../utils/wallet");

describe("Clerk SSO Service (Unit)", () => {
    let mockRepo, mockLogger, service;

    beforeEach(() => {
        mockRepo = {
            findUserByEmail: jest.fn(),
            createUser: jest.fn(),
            saveUser: jest.fn(),
            findOAuthAccount: jest.fn(),
            createOAuthAccount: jest.fn(),
            findWalletByUserAndRole: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
        service = createClerkSSOService(mockRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    it("should throw AppError 400 on empty token fields parameters", async () => {
        await expect(service.clerkSSO({ clerkToken: "" }))
            .rejects.toMatchObject({ status: 400, message: "Missing Clerk token" });
    });

    it("should throw AppError 401 if decoded sub fields parameters fail validation values", async () => {
        jwt.decode.mockReturnValue(null);

        await expect(service.clerkSSO({ clerkToken: "bad_token" }))
            .rejects.toMatchObject({ status: 401, message: "Invalid Clerk token" });
    });

    it("should handle existing account records, execute roles merges, and spin up missing wallet slots", async () => {
        jwt.decode.mockReturnValue({ sub: "clerk_sub_123" });
        const mockClerkUser = {
            id: "clerk_sub_123",
            emailAddresses: [{ emailAddress: "clerk@test.com" }],
            firstName: "John",
            lastName: "Doe",
            externalAccounts: [{ provider: "oauth_google", providerUserId: "google_123" }],
        };
        clerkClient.users.getUser.mockResolvedValue(mockClerkUser);

        const mockDbUser = { _id: "db_user_123", email: "clerk@test.com", roles: ["mentee"] };
        mockRepo.findUserByEmail.mockResolvedValue(mockDbUser);

        // Simulate merging roles
        mergeRoles.mockImplementation((user) => {
            user.roles = ["mentee", "mentor"];
        });
        mockRepo.findWalletByUserAndRole.mockResolvedValue(null); // trigger provisioning logic

        const result = await service.clerkSSO({ clerkToken: "token", roles: ["mentor"] });

        expect(mockRepo.findUserByEmail).toHaveBeenCalledWith("clerk@test.com");
        expect(mergeRoles).toHaveBeenCalled();
        expect(provisionWallet).toHaveBeenCalledWith("db_user_123", "mentor");
        expect(result.isNewUser).toBe(false);
    });

    it("should enforce user agreement checks by rejecting registration requests when terms are unaccepted", async () => {
        jwt.decode.mockReturnValue({ sub: "clerk_sub_123" });
        const mockClerkUser = {
            id: "clerk_sub_123",
            emailAddresses: [{ emailAddress: "new@test.com" }],
        };
        clerkClient.users.getUser.mockResolvedValue(mockClerkUser);
        mockRepo.findUserByEmail.mockResolvedValue(null);

        await expect(service.clerkSSO({ clerkToken: "token", termsAccepted: false }))
            .rejects.toMatchObject({ status: 400, message: "You must accept terms to continue" });
    });
});