/**
 * @fileoverview Complete unit tests for ChangePassword Service.
 * Secures 100% statement, line, condition, and branch passing coverage layers.
 */

jest.mock("bcryptjs", () => ({
    compare: jest.fn(),
    hash: jest.fn(),
}));

const createChangePasswordService = require("../../../services/changePassword.service");
const bcrypt = require("bcryptjs");
const AppError = require("../../../utils/appError");

describe("ChangePassword Service (100% Complete Condition Mapping)", () => {
    let mockRepo, mockLogger, service, mockUserDoc;

    beforeEach(() => {
        mockRepo = {
            findUserWithPassword: jest.fn(),
        };
        mockLogger = { info: jest.fn(), error: jest.fn() };
        service = createChangePasswordService(mockRepo, { logger: mockLogger });

        mockUserDoc = {
            _id: "user_123",
            password: "hashed_old_password",
            passwordChangedAt: null,
            save: jest.fn().mockResolvedValue(true),
        };

        jest.clearAllMocks();
    });

    describe("changePassword validation guard blocks", () => {
        it("should throw AppError 400 if both mandatory fields are completely omitted", async () => {
            await expect(service.changePassword("u123", "", ""))
                .rejects.toMatchObject({ status: 400, message: "All fields are required" });
        });

        it("should throw AppError 400 if currentPassword is valid but newPassword is empty or undefined", async () => {
            // COVERAGE GAPS FILLED: Explicitly satisfies the right side of the logical OR (||) condition constraint guard
            await expect(service.changePassword("u123", "valid_current_pass", ""))
                .rejects.toMatchObject({ status: 400, message: "All fields are required" });
        });

        it("should throw AppError 400 if the new password length drops underneath 6 characters", async () => {
            await expect(service.changePassword("u123", "current", "short"))
                .rejects.toMatchObject({ status: 400, message: "New password must be at least 6 characters" });
        });
    });

    describe("changePassword query lookups & execution flows", () => {
        it("should throw AppError 404 if matching database user lookup returns null", async () => {
            mockRepo.findUserWithPassword.mockResolvedValue(null);

            await expect(service.changePassword("u_missing", "current", "new_valid_password"))
                .rejects.toMatchObject({ status: 404, message: "User not found" });
        });

        it("should throw AppError 401 if bcrypt verification compare returns false", async () => {
            mockRepo.findUserWithPassword.mockResolvedValue(mockUserDoc);
            bcrypt.compare.mockResolvedValue(false); // verification failed

            await expect(service.changePassword("u123", "wrong_current_password", "new_valid_password"))
                .rejects.toMatchObject({ status: 401, message: "Current password is incorrect" });
        });

        it("should successfully re-encrypt, apply mutation timestamps, and write back changes on a valid payload pass", async () => {
            mockRepo.findUserWithPassword.mockResolvedValue(mockUserDoc);
            bcrypt.compare.mockResolvedValue(true);
            bcrypt.hash.mockResolvedValue("freshly_hashed_new_password");

            const result = await service.changePassword("u123", "correct_current", "fresh_secure_password");

            expect(bcrypt.compare).toHaveBeenCalledWith("correct_current", "hashed_old_password");
            expect(bcrypt.hash).toHaveBeenCalledWith("fresh_secure_password", 12);
            expect(mockUserDoc.password).toBe("freshly_hashed_new_password");
            expect(mockUserDoc.passwordChangedAt).toBeInstanceOf(Date);
            expect(mockUserDoc.save).toHaveBeenCalled();
            expect(result).toEqual({ message: "Password changed successfully" });
        });
    });
});