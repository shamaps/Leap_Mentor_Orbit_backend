/**
 * @fileoverview Unit tests for Register Repository.
 * Secures 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("@leapmentor/shared/models/User", () => ({
    findOne: jest.fn(),
    create: jest.fn(),
}));


jest.mock("@leapmentor/shared/utils/logger", () => ({
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
}));

const User = require("@leapmentor/shared/models/User");

const repository = require("../../../src/repositories/register.repository");

describe("Register Repository (100% Full Line Coverage Blueprint)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("User Operations", () => {
        it("should call findOne matching the exact normalized email query criterion", async () => {
            await repository.findUserByEmail("test@leapmentor.com");
            expect(User.findOne).toHaveBeenCalledWith({ email: "test@leapmentor.com" });
        });

        it("should execute the exact instance document save chain on safe user rows references", async () => {
            const mockUserInstance = { save: jest.fn().mockResolvedValue({ id: "usr_001" }) };
            const result = await repository.saveUser(mockUserInstance);
            expect(mockUserInstance.save).toHaveBeenCalled();
            expect(result).toEqual({ id: "usr_001" });
        });

        it("should pass dynamic user payloads forward to the create pipeline model method", async () => {
            const payload = { email: "new@test.com", roles: ["mentee"] };
            await repository.createUser(payload);
            expect(User.create).toHaveBeenCalledWith(payload);
        });
    });

  
});