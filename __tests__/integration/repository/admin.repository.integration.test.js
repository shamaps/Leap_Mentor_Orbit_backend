/**
 * @fileoverview Integration tests for Admin Repository.
 * Executes queries directly against a living MongoMemoryServer instance.
 */

const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/admin.repository");
const { makeAdminUser, makeUser } = require("../../fixtures/createTestData");

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Admin Repository (Integration)", () => {
    describe("findAdminByEmail", () => {
        it("should retrieve a seeded admin profile by its email reference", async () => {
            // Refactored to leverage centralized real model factories
            await makeAdminUser({
                name: "System Admin",
                email: "superadmin@leap.com",
                password: "hashed_secure_password",
                isActive: true,
            });

            const admin = await repo.findAdminByEmail("superadmin@leap.com");
            expect(admin).toBeTruthy();
            expect(admin.email).toBe("superadmin@leap.com");
        });

        it("should resolve to null if the targeted email does not exist", async () => {
            const admin = await repo.findAdminByEmail("nonexistent@leap.com");
            expect(admin).toBeNull();
        });
    });

    describe("countAllUsers", () => {
        it("should calculate matching user counts while explicitly skipping global soft-delete layers", async () => {
            // Enforces realistic production constraints (exactly one role array and termsAccepted validation checks)
            await makeUser({ name: "User One", email: "one@test.com", roles: ["mentor"], isDeleted: false });
            await makeUser({ name: "User Two", email: "two@test.com", roles: ["mentor"], isDeleted: true });
            await makeUser({ name: "User Three", email: "three@test.com", roles: ["mentee"], isDeleted: false });

            const mentorCount = await repo.countAllUsers({ roles: "mentor" });
            expect(mentorCount).toBe(2);
        });
    });

    describe("blockUserById", () => {
        it("should correctly write soft-delete state updates and capture exact operation timestamps", async () => {
            const createdUser = await makeUser({
                name: "Flagged Account",
                email: "flagged@test.com",
                roles: ["mentee"],
                isDeleted: false,
            });

            const updatedUser = await repo.blockUserById(createdUser._id);
            expect(updatedUser.isDeleted).toBe(true);
            expect(updatedUser.deletedAt).toBeInstanceOf(Date);
        });
    });
});