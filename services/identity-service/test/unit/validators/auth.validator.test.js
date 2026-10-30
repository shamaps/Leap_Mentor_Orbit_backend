const {
    registerSchema,
    loginSchema,
    changePasswordSchema,
    forgotPasswordSchema,
    verifyOtpSchema,
    resetPasswordSchema,
} = require("../../../src/validators/auth.validator");

const validRegister = () => ({
    name: "Shama Khan",
    email: "shama@example.com",
    password: "StrongPass1",
    roles: ["mentee"],
    termsAccepted: true,
});

const messages = (result) => result.error.details.map((d) => d.message);

describe("Auth Validators (Unit)", () => {
    describe("registerSchema", () => {
        it("should accept a valid registration payload", () => {
            const { error } = registerSchema.validate(validRegister());

            expect(error).toBeUndefined();
        });

        it("should trim the name and lowercase the email", () => {
            const { error, value } = registerSchema.validate({
                ...validRegister(),
                name: "  Shama Khan  ",
                email: "Shama@Example.COM",
            });

            expect(error).toBeUndefined();
            expect(value.name).toBe("Shama Khan");
            expect(value.email).toBe("shama@example.com");
        });

        it.each(["name", "email", "password", "roles", "termsAccepted"])("should reject a payload missing %s", (field) => {
            const payload = validRegister();
            delete payload[field];

            const { error } = registerSchema.validate(payload);

            expect(error).toBeDefined();
            expect(error.details[0].path).toEqual([field]);
        });

        it("should enforce name length between 2 and 100 characters", () => {
            expect(registerSchema.validate({ ...validRegister(), name: "A" }).error).toBeDefined();
            expect(registerSchema.validate({ ...validRegister(), name: " A " }).error).toBeDefined(); // trimmed to 1
            expect(registerSchema.validate({ ...validRegister(), name: "Al" }).error).toBeUndefined();
            expect(registerSchema.validate({ ...validRegister(), name: "a".repeat(100) }).error).toBeUndefined();
            expect(registerSchema.validate({ ...validRegister(), name: "a".repeat(101) }).error).toBeDefined();
        });

        it("should reject an invalid email", () => {
            expect(registerSchema.validate({ ...validRegister(), email: "not-an-email" }).error).toBeDefined();
        });

        it("should enforce password length between 8 and 128 characters", () => {
            expect(registerSchema.validate({ ...validRegister(), password: "a".repeat(7) }).error).toBeDefined();
            expect(registerSchema.validate({ ...validRegister(), password: "a".repeat(8) }).error).toBeUndefined();
            expect(registerSchema.validate({ ...validRegister(), password: "a".repeat(128) }).error).toBeUndefined();
            expect(registerSchema.validate({ ...validRegister(), password: "a".repeat(129) }).error).toBeDefined();
        });

        it.each([["mentor"], ["mentee"]])("should accept the single role %p", (role) => {
            expect(registerSchema.validate({ ...validRegister(), roles: [role] }).error).toBeUndefined();
        });

        it("should reject an empty roles array", () => {
            expect(registerSchema.validate({ ...validRegister(), roles: [] }).error).toBeDefined();
        });

        it("should reject more than one role", () => {
            expect(registerSchema.validate({ ...validRegister(), roles: ["mentor", "mentee"] }).error).toBeDefined();
        });

        it("should not allow self-registering as admin or any unknown role", () => {
            expect(registerSchema.validate({ ...validRegister(), roles: ["admin"] }).error).toBeDefined();
            expect(registerSchema.validate({ ...validRegister(), roles: ["superuser"] }).error).toBeDefined();
        });

        it("should reject roles that is not an array", () => {
            expect(registerSchema.validate({ ...validRegister(), roles: "mentee" }).error).toBeDefined();
        });

        it("should reject termsAccepted false with the custom message", () => {
            const result = registerSchema.validate({ ...validRegister(), termsAccepted: false });

            expect(messages(result)).toContain("You must accept terms to continue");
        });

        it("should reject unknown fields, so extra privileged properties cannot be smuggled in", () => {
            const result = registerSchema.validate({ ...validRegister(), isAdmin: true });

            expect(result.error).toBeDefined();
            expect(result.error.details[0].path).toEqual(["isAdmin"]);
        });
    });

    describe("loginSchema", () => {
        it("should accept an email and password", () => {
            expect(loginSchema.validate({ email: "a@example.com", password: "x" }).error).toBeUndefined();
        });

        it("should not impose a minimum password length, so old short passwords can still log in", () => {
            expect(loginSchema.validate({ email: "a@example.com", password: "1" }).error).toBeUndefined();
        });

        it("should reject a missing email or password", () => {
            expect(loginSchema.validate({ password: "x" }).error).toBeDefined();
            expect(loginSchema.validate({ email: "a@example.com" }).error).toBeDefined();
        });

        it("should reject an empty password and an invalid email", () => {
            expect(loginSchema.validate({ email: "a@example.com", password: "" }).error).toBeDefined();
            expect(loginSchema.validate({ email: "nope", password: "x" }).error).toBeDefined();
        });

        it("should reject object values, blocking NoSQL operator injection", () => {
            expect(loginSchema.validate({ email: { $gt: "" }, password: "x" }).error).toBeDefined();
            expect(loginSchema.validate({ email: "a@example.com", password: { $ne: null } }).error).toBeDefined();
        });

        it("should reject unknown fields", () => {
            expect(loginSchema.validate({ email: "a@example.com", password: "x", role: "admin" }).error).toBeDefined();
        });
    });

    describe("changePasswordSchema", () => {
        it("should accept a current and a valid new password", () => {
            expect(changePasswordSchema.validate({ currentPassword: "old", newPassword: "NewPass123" }).error).toBeUndefined();
        });

        it("should enforce new password length between 8 and 128 characters", () => {
            expect(changePasswordSchema.validate({ currentPassword: "old", newPassword: "a".repeat(7) }).error).toBeDefined();
            expect(changePasswordSchema.validate({ currentPassword: "old", newPassword: "a".repeat(8) }).error).toBeUndefined();
            expect(changePasswordSchema.validate({ currentPassword: "old", newPassword: "a".repeat(128) }).error).toBeUndefined();
            expect(changePasswordSchema.validate({ currentPassword: "old", newPassword: "a".repeat(129) }).error).toBeDefined();
        });

        it("should require both fields", () => {
            expect(changePasswordSchema.validate({ newPassword: "NewPass123" }).error).toBeDefined();
            expect(changePasswordSchema.validate({ currentPassword: "old" }).error).toBeDefined();
        });

        it("should reject unknown fields", () => {
            expect(changePasswordSchema.validate({ currentPassword: "old", newPassword: "NewPass123", userId: "x" }).error).toBeDefined();
        });
    });

    describe("forgotPasswordSchema", () => {
        it("should accept a valid email", () => {
            expect(forgotPasswordSchema.validate({ email: "a@example.com" }).error).toBeUndefined();
        });

        it("should reject a missing or invalid email", () => {
            expect(forgotPasswordSchema.validate({}).error).toBeDefined();
            expect(forgotPasswordSchema.validate({ email: "bad" }).error).toBeDefined();
        });
    });

    describe("verifyOtpSchema", () => {
        it("should accept an email and a 6-character OTP", () => {
            expect(verifyOtpSchema.validate({ email: "a@example.com", otp: "123456" }).error).toBeUndefined();
        });

        it.each(["12345", "1234567", ""])("should reject an OTP of the wrong length (%p)", (otp) => {
            expect(verifyOtpSchema.validate({ email: "a@example.com", otp }).error).toBeDefined();
        });

        it("should reject an OTP sent as a number instead of a string", () => {
            expect(verifyOtpSchema.validate({ email: "a@example.com", otp: 123456 }).error).toBeDefined();
        });

        it("should require both fields", () => {
            expect(verifyOtpSchema.validate({ otp: "123456" }).error).toBeDefined();
            expect(verifyOtpSchema.validate({ email: "a@example.com" }).error).toBeDefined();
        });
    });

    describe("resetPasswordSchema", () => {
        const valid = () => ({ email: "a@example.com", otp: "123456", newPassword: "NewPass123" });

        it("should accept email, OTP and new password", () => {
            expect(resetPasswordSchema.validate(valid()).error).toBeUndefined();
        });

        it("should enforce new password length between 8 and 128 characters", () => {
            expect(resetPasswordSchema.validate({ ...valid(), newPassword: "a".repeat(7) }).error).toBeDefined();
            expect(resetPasswordSchema.validate({ ...valid(), newPassword: "a".repeat(129) }).error).toBeDefined();
        });

        it("should reject a wrong-length OTP", () => {
            expect(resetPasswordSchema.validate({ ...valid(), otp: "12345" }).error).toBeDefined();
        });

        it.each(["email", "otp", "newPassword"])("should reject a payload missing %s", (field) => {
            const payload = valid();
            delete payload[field];

            expect(resetPasswordSchema.validate(payload).error).toBeDefined();
        });

        it("should reject the old token-style payload", () => {
            expect(resetPasswordSchema.validate({ token: "abc", newPassword: "NewPass123" }).error).toBeDefined();
        });
    });
});
