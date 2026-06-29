/**
 * @fileoverview Unit tests for Login Repository.
 * Reaches 100% statement, line, function, and database catch path coverage.
 */

// Mock the Mongoose User Model dependency completely
jest.mock("../../../models/User", () => {
    const mockQuery = {
        setOptions: jest.fn(),
    };
    return {
        findOne: jest.fn(() => mockQuery),
        _mockQuery: mockQuery,
    };
});

// Mock the core winston logging utility
jest.mock("../../../utils/logger", () => ({
    error: jest.fn(),
}));

const User = require("../../../models/User");
const logger = require("../../../utils/logger");
const repository = require("../../../repositories/login.repository");

describe("Login Repository (100% Comprehensive Coverage Mapping)", () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("findUserByEmail", () => {
        it("should successfully locate a user profile by email and override soft-delete query filter options", async () => {
            const mockUserDoc = { _id: "user_777", email: "test@leapmentor.com", roles: ["mentee"] };
            User._mockQuery.setOptions.mockResolvedValue(mockUserDoc);

            const result = await repository.findUserByEmail("test@leapmentor.com");

            expect(User.findOne).toHaveBeenCalledWith({ email: "test@leapmentor.com" });
            expect(User._mockQuery.setOptions).toHaveBeenCalledWith({ ignoreIsDeleted: true });
            expect(result).toEqual(mockUserDoc);
        });

        it("should log the exception and rethrow low-level Mongoose query errors when findOne or setOptions rejects", async () => {
            const dbError = new Error("Cluster Primary Failover Read Lock Timeout");
            User._mockQuery.setOptions.mockRejectedValue(dbError);

            await expect(repository.findUserByEmail("test@leapmentor.com"))
                .rejects.toThrow("Cluster Primary Failover Read Lock Timeout");

            expect(logger.error).toHaveBeenCalledWith("DB error in findUserByEmail", {
                email: "test@leapmentor.com",
                error: "Cluster Primary Failover Read Lock Timeout",
            });
        });
    });
});