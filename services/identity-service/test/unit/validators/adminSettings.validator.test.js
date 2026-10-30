const {
    changePasswordSchema,
    addAdminSchema,
    updateCommissionSchema,
} = require("../../../src/validators/adminSettings.validator");

describe("Admin Settings Validators (Unit)", () => {
    describe("changePasswordSchema", () => {
        it("should accept a current and a valid new password", () => {
            expect(changePasswordSchema.validate({ currentPassword: "old", newPassword: "newpass" }).error).toBeUndefined();
        });

        it("should enforce new password length between 6 and 128 characters", () => {
            expect(changePasswordSchema.validate({ currentPassword: "old", newPassword: "a".repeat(5) }).error).toBeDefined();
            expect(changePasswordSchema.validate({ currentPassword: "old", newPassword: "a".repeat(6) }).error).toBeUndefined();
            expect(changePasswordSchema.validate({ currentPassword: "old", newPassword: "a".repeat(128) }).error).toBeUndefined();
            expect(changePasswordSchema.validate({ currentPassword: "old", newPassword: "a".repeat(129) }).error).toBeDefined();
        });

        it("should require both fields", () => {
            expect(changePasswordSchema.validate({ newPassword: "newpass" }).error).toBeDefined();
            expect(changePasswordSchema.validate({ currentPassword: "old" }).error).toBeDefined();
        });
    });

    describe("addAdminSchema", () => {
        it("should accept a valid name and email", () => {
            expect(addAdminSchema.validate({ name: "New Admin", email: "admin@example.com" }).error).toBeUndefined();
        });

        it("should trim the name and lowercase the email", () => {
            const { error, value } = addAdminSchema.validate({ name: "  New Admin ", email: "Admin@Example.COM" });

            expect(error).toBeUndefined();
            expect(value).toEqual({ name: "New Admin", email: "admin@example.com" });
        });

        it("should enforce name length between 2 and 100 characters", () => {
            expect(addAdminSchema.validate({ name: "A", email: "a@example.com" }).error).toBeDefined();
            expect(addAdminSchema.validate({ name: "Al", email: "a@example.com" }).error).toBeUndefined();
            expect(addAdminSchema.validate({ name: "a".repeat(100), email: "a@example.com" }).error).toBeUndefined();
            expect(addAdminSchema.validate({ name: "a".repeat(101), email: "a@example.com" }).error).toBeDefined();
        });

        it("should reject an invalid email", () => {
            expect(addAdminSchema.validate({ name: "New Admin", email: "nope" }).error).toBeDefined();
        });

        it("should require both fields", () => {
            expect(addAdminSchema.validate({ email: "a@example.com" }).error).toBeDefined();
            expect(addAdminSchema.validate({ name: "New Admin" }).error).toBeDefined();
        });
    });

    describe("updateCommissionSchema", () => {
        it.each([0, 10, 12.5, 100])("should accept a commission rate of %p", (commissionRate) => {
            expect(updateCommissionSchema.validate({ commissionRate }).error).toBeUndefined();
        });

        it.each([-0.01, -1, 100.01, 101])("should reject a commission rate of %p (outside 0-100)", (commissionRate) => {
            expect(updateCommissionSchema.validate({ commissionRate }).error).toBeDefined();
        });

        it("should reject a non-numeric commission rate", () => {
            expect(updateCommissionSchema.validate({ commissionRate: "abc" }).error).toBeDefined();
            expect(updateCommissionSchema.validate({ commissionRate: null }).error).toBeDefined();
        });

        it("should convert a numeric string into a number", () => {
            const { error, value } = updateCommissionSchema.validate({ commissionRate: "15" });

            expect(error).toBeUndefined();
            expect(value.commissionRate).toBe(15);
        });

        it("should require commissionRate", () => {
            expect(updateCommissionSchema.validate({}).error).toBeDefined();
        });
    });
});
