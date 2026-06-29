jest.mock("bcryptjs", () => ({
    compare: jest.fn(),
    hash: jest.fn(),
}));

const createChangePasswordService = require("../../../services/adminSettings.service"); // or changePassword.service
const createTargetService = require("../../../services/changePassword.service");
const bcrypt = require("bcryptjs");

describe("Change Password Service (Unit)", () => {
    let mockRepo, mockLogger, service;

    beforeEach(() => {
        mockRepo = { findUserWithPassword: jest.fn() };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createTargetService(mockRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    it("should throw AppError 400 if required text arguments are missing", async () => {
        await expect(service.changePassword("u1", "", "newpassword"))
            .rejects.toMatchObject({ status: 400, message: "All fields are required" });
    });

    it("should throw AppError 400 if newPassword fails length check constraints", async () => {
        await expect(service.changePassword("u1", "oldpass", "123"))
            .rejects.toMatchObject({ status: 400, message: "New password must be at least 6 characters" });
    });

    it("should throw AppError 401 if bcrypt password match evaluation fails", async () => {
        const mockUser = { password: "hashed_old_password" };
        mockRepo.findUserWithPassword.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(false);

        await expect(service.changePassword("u1", "wrong_old_pass", "new_secure_pass"))
            .rejects.toMatchObject({ status: 401, message: "Current password is incorrect" });
    });

    it("should update password, set change timestamp, and save document on successful updates", async () => {
        const mockUserDoc = {
            password: "hashed_old_password",
            save: jest.fn().mockResolvedValue(true),
        };
        mockRepo.findUserWithPassword.mockResolvedValue(mockUserDoc);
        bcrypt.compare.mockResolvedValue(true);
        bcrypt.hash.mockResolvedValue("new_hashed_password");

        const result = await service.changePassword("u1", "correct_old_pass", "new_secure_pass");

        expect(bcrypt.hash).toHaveBeenCalledWith("new_secure_pass", 12);
        expect(mockUserDoc.password).toBe("new_hashed_password");
        expect(mockUserDoc.passwordChangedAt).toBeInstanceOf(Date);
        expect(mockUserDoc.save).toHaveBeenCalled();
        expect(result.message).toBe("Password changed successfully");
    });
});