jest.mock("../../../utils/mappers/user.mapper", () => ({
    toUserDTO: jest.fn((user) => user),
}));

const createLoginService = require("../../../services/login.service");

describe("Login Service (Unit)", () => {
    let mockRepo, mockLogger, service, mockUserDoc;

    beforeEach(() => {
        mockRepo = { findUserByEmail: jest.fn() };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createLoginService(mockRepo, { logger: mockLogger });

        mockUserDoc = {
            _id: "user_123",
            email: "clean@test.com",
            password: "encrypted_string",
            isDeleted: false,
            isEmailVerified: true,
            matchPassword: jest.fn(),
        };
        jest.clearAllMocks();
    });

    it("should throw AppError 400 if email or password elements are unassigned", async () => {
        await expect(service.login("", "pass"))
            .rejects.toMatchObject({ status: 400, message: "email and password are required" });
    });

    it("should throw AppError 401 if identity claims don't match or the email is unregistered", async () => {
        mockRepo.findUserByEmail.mockResolvedValue(null);

        await expect(service.login("ghost@test.com", "any"))
            .rejects.toMatchObject({ status: 401, message: "Invalid credentials" });
        expect(mockLogger.warn).toHaveBeenCalledWith("Login attempt with unregistered email", expect.any(Object));
    });

    it("should throw AppError 403 if the targeted account soft-deletion block flag is active", async () => {
        mockUserDoc.isDeleted = true;
        mockRepo.findUserByEmail.mockResolvedValue(mockUserDoc);

        await expect(service.login("clean@test.com", "secret"))
            .rejects.toMatchObject({ status: 403, message: "Your account has been blocked. Please contact support." });
    });

    it("should throw AppError 401 if password check triggers falsy match results", async () => {
        mockUserDoc.matchPassword.mockResolvedValue(false);
        mockRepo.findUserByEmail.mockResolvedValue(mockUserDoc);

        await expect(service.login("clean@test.com", "wrong_pass"))
            .rejects.toMatchObject({ status: 401, message: "Invalid credentials" });
    });

    it("should throw AppError 403 if validation checks find the verification lifecycle flags are false", async () => {
        mockUserDoc.matchPassword.mockResolvedValue(true);
        mockUserDoc.isEmailVerified = false;
        mockRepo.findUserByEmail.mockResolvedValue(mockUserDoc);

        await expect(service.login("clean@test.com", "right_pass"))
            .rejects.toMatchObject({ status: 403, message: "Please verify your email before logging in." });
    });

    it("should emit a clean DTO structural mapping layout upon clearing all business validation rules", async () => {
        mockUserDoc.matchPassword.mockResolvedValue(true);
        mockRepo.findUserByEmail.mockResolvedValue(mockUserDoc);

        const result = await service.login(" CLEAN@test.com ", "right_pass");

        expect(mockRepo.findUserByEmail).toHaveBeenCalledWith("clean@test.com");
        expect(result.user).toHaveProperty("_id", "user_123");
    });
});