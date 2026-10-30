const { adminLoginSchema, getUsersQuerySchema } = require("../../../src/validators/admin.validator");

describe("Admin Validators (Unit)", () => {
    describe("adminLoginSchema", () => {
        it("should accept an email and password", () => {
            expect(adminLoginSchema.validate({ email: "admin@example.com", password: "x" }).error).toBeUndefined();
        });

        it("should reject a missing email or password", () => {
            expect(adminLoginSchema.validate({ password: "x" }).error).toBeDefined();
            expect(adminLoginSchema.validate({ email: "admin@example.com" }).error).toBeDefined();
        });

        it("should reject an invalid email or an empty password", () => {
            expect(adminLoginSchema.validate({ email: "admin", password: "x" }).error).toBeDefined();
            expect(adminLoginSchema.validate({ email: "admin@example.com", password: "" }).error).toBeDefined();
        });

        it("should reject object values, blocking NoSQL operator injection", () => {
            expect(adminLoginSchema.validate({ email: { $ne: null }, password: "x" }).error).toBeDefined();
            expect(adminLoginSchema.validate({ email: "admin@example.com", password: { $ne: null } }).error).toBeDefined();
        });

        it("should reject unknown fields", () => {
            expect(adminLoginSchema.validate({ email: "admin@example.com", password: "x", remember: true }).error).toBeDefined();
        });
    });

    describe("getUsersQuerySchema", () => {
        it("should accept an empty query, since every field is optional", () => {
            expect(getUsersQuerySchema.validate({}).error).toBeUndefined();
        });

        it("should accept a full valid query", () => {
            const { error } = getUsersQuerySchema.validate({ search: "sam", role: "mentor", page: 2, limit: 50, deleted: "true" });

            expect(error).toBeUndefined();
        });

        it("should accept empty-string search and role, as sent by a cleared filter box", () => {
            expect(getUsersQuerySchema.validate({ search: "", role: "" }).error).toBeUndefined();
        });

        it("should limit search to 100 characters", () => {
            expect(getUsersQuerySchema.validate({ search: "a".repeat(100) }).error).toBeUndefined();
            expect(getUsersQuerySchema.validate({ search: "a".repeat(101) }).error).toBeDefined();
        });

        it("should only allow the mentor and mentee roles", () => {
            expect(getUsersQuerySchema.validate({ role: "mentor" }).error).toBeUndefined();
            expect(getUsersQuerySchema.validate({ role: "mentee" }).error).toBeUndefined();
            expect(getUsersQuerySchema.validate({ role: "admin" }).error).toBeDefined();
        });

        it("should convert numeric strings from the query string into numbers", () => {
            const { error, value } = getUsersQuerySchema.validate({ page: "3", limit: "25" });

            expect(error).toBeUndefined();
            expect(value).toMatchObject({ page: 3, limit: 25 });
        });

        it("should require page to be an integer of at least 1", () => {
            expect(getUsersQuerySchema.validate({ page: 1 }).error).toBeUndefined();
            expect(getUsersQuerySchema.validate({ page: 0 }).error).toBeDefined();
            expect(getUsersQuerySchema.validate({ page: -1 }).error).toBeDefined();
            expect(getUsersQuerySchema.validate({ page: 1.5 }).error).toBeDefined();
            expect(getUsersQuerySchema.validate({ page: "abc" }).error).toBeDefined();
        });

        it("should require limit to be an integer between 1 and 100", () => {
            expect(getUsersQuerySchema.validate({ limit: 1 }).error).toBeUndefined();
            expect(getUsersQuerySchema.validate({ limit: 100 }).error).toBeUndefined();
            expect(getUsersQuerySchema.validate({ limit: 0 }).error).toBeDefined();
            expect(getUsersQuerySchema.validate({ limit: 101 }).error).toBeDefined();
            expect(getUsersQuerySchema.validate({ limit: 10.5 }).error).toBeDefined();
        });

        it('should accept only the strings "true" and "false" for deleted', () => {
            expect(getUsersQuerySchema.validate({ deleted: "true" }).error).toBeUndefined();
            expect(getUsersQuerySchema.validate({ deleted: "false" }).error).toBeUndefined();
            expect(getUsersQuerySchema.validate({ deleted: "yes" }).error).toBeDefined();
            expect(getUsersQuerySchema.validate({ deleted: true }).error).toBeDefined();
        });

        it("should reject unknown query parameters", () => {
            expect(getUsersQuerySchema.validate({ sort: "name" }).error).toBeDefined();
        });
    });
});
