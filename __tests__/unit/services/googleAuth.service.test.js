jest.mock("jsonwebtoken", () => ({
    decode: jest.fn(),
}));

jest.mock("../../../utils/withTimeout", () => ({
    withTimeout: jest.fn((promise) => promise),
}));

jest.mock("../../../utils/auth.utils", () => ({
    googleClient: {
        verifyIdToken: jest.fn(),
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

jest.mock("../../../config/env", () => ({
    googleClientId: "mock_google_client_id_123",
}));

const createGoogleAuthService = require("../../../services/googleAuth.service");
const jwt = require("jsonwebtoken");
const { googleClient, validateRoles, mergeRoles } = require("../../../utils/auth.utils");
const { provisionWallet } = require("../../../utils/wallet");

describe("Google Auth Service (Unit)", () => {
    let mockRepo, mockLogger, service;

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
        jest.clearAllMocks();
    });

    it("should throw AppError 400 on empty credentials fields parameters", async () => {
        await expect(service.googleAuth({ credential: "" }))
            .rejects.toMatchObject({ status: 400, message: "Missing Google credential" });
    });

    it("should handle existing account nodes and invoke roles merge strategies smoothly", async () => {
        jwt.decode.mockReturnValue({ aud: "mock_google_client_id_123" });
        const mockTicket = {
            getPayload: () => ({
                email: "oauth@test.com",
                name: "OAuth User",
                sub: "google_sub_id_789",
                email_verified: true,
                aud: "mock_google_client_id_123"
            })
        };
        googleClient.verifyIdToken.mockResolvedValue(mockTicket);

        const mockDbUser = { _id: "db_user_555", email: "oauth@test.com", roles: ["mentee"] };
        mockRepo.findUserByEmail.mockResolvedValue(mockDbUser);
        mockRepo.findOAuthAccount.mockResolvedValue({ _id: "link_exists" });

        const result = await service.googleAuth({ credential: "raw_jwt", roles: ["mentor"] });

        expect(mockRepo.findUserByEmail).toHaveBeenCalledWith("oauth@test.com");
        expect(mergeRoles).toHaveBeenCalledWith(mockDbUser, ["mentor"], mockRepo.saveUser);
        expect(result.isNewUser).toBe(false);
    });

    it("should reject creation flows if terms are unaccepted by the consumer", async () => {
        jwt.decode.mockReturnValue({ aud: "mock_google_client_id_123" });
        const mockTicket = {
            getPayload: () => ({
                email: "new_oauth@test.com",
                sub: "google_sub_id_000",
                email_verified: true,
                aud: "mock_google_client_id_123"
            })
        };
        googleClient.verifyIdToken.mockResolvedValue(mockTicket);
        mockRepo.findUserByEmail.mockResolvedValue(null);

        await expect(service.googleAuth({ credential: "raw_jwt", termsAccepted: false }))
            .rejects.toMatchObject({ status: 400, message: "You must accept terms to continue" });
    });
});