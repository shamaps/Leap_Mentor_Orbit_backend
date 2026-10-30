const jwt = require("jsonwebtoken");
const config = require("../../config/env");
const { generateAccessToken, generateRefreshToken } = require("../../utils/generateToken");

describe("generateAccessToken", () => {
    test("signs { id } with the JWT secret", () => {
        const token = generateAccessToken("user-123");
        const decoded = jwt.verify(token, config.jwtSecret);
        expect(decoded.id).toBe("user-123");
    });

    test("expires after the configured access lifetime (15m by default)", () => {
        const { iat, exp } = jwt.decode(generateAccessToken("u"));
        expect(exp - iat).toBe(15 * 60);
    });

    test("is rejected when verified with a different secret", () => {
        expect(() => jwt.verify(generateAccessToken("u"), "another-secret")).toThrow(/invalid signature/);
    });

    test("is a three-part JWT", () => {
        expect(generateAccessToken("u").split(".")).toHaveLength(3);
    });
});

describe("generateRefreshToken", () => {
    test("is 80 lowercase hex characters (40 random bytes)", () => {
        expect(generateRefreshToken()).toMatch(/^[0-9a-f]{80}$/);
    });

    test("is unique per call", () => {
        const tokens = new Set(Array.from({ length: 100 }, generateRefreshToken));
        expect(tokens.size).toBe(100);
    });
});
