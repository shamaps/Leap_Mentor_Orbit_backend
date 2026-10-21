/**
 * @fileoverview Unit tests for Authenticate Middleware.
 * Secures 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("jsonwebtoken");
jest.mock("@sentry/node");
jest.mock("../../../models/User");
jest.mock("../../../utils/logger", () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));
jest.mock("../../../utils/mask", () => ({
    maskEmail: jest.fn((email) => email ? "masked_" + email : ""),
}));
jest.mock("../../../config/env", () => ({
    jwtSecret: "app_jwt_secret_key_2026",
}));

const jwt = require("jsonwebtoken");
const User = require("../../../models/User");
const logger = require("../../../utils/logger");
const { authenticate } = require("../../../middleware/authenticate");

describe("Authentication Middleware Matrix Suite", () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            cookies: { accessToken: "cookie_token_123" },
            headers: { authorization: "Bearer header_token_456" },
            path: "/api/test",
            method: "POST",
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    describe("authenticate basic token tracking behaviors", () => {
        it("should process requests using access tokens stored inside req.cookies parameters", async () => {
            // CONDITION COVERAGE GAPS FILLED: req.cookies.accessToken evaluates to truthy
            jwt.verify.mockReturnValue({ id: "u_01" });
            User.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue({ _id: "u_01", email: "a@test.com", roles: ["mentor"] }),
            });

            await authenticate(req, res, next);

            expect(jwt.verify).toHaveBeenCalledWith("cookie_token_123", "app_jwt_secret_key_2026");
            expect(next).toHaveBeenCalled();
        });

        it("should look into authorization headers fallback sequences if cookies lack keys properties", async () => {
            // CONDITION COVERAGE GAPS FILLED: req.cookies is missing, reads header.authorization split index
            req.cookies = null;
            jwt.verify.mockReturnValue({ id: "u_02" });
            User.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue({ _id: "u_02", email: "b@test.com", roles: ["mentee"] }),
            });

            await authenticate(req, res, next);

            expect(jwt.verify).toHaveBeenCalledWith("header_token_456", "app_jwt_secret_key_2026");
            expect(next).toHaveBeenCalled();
        });

        it("should issue a 401 error message status response code if both vectors evaluate falsy", async () => {
            // CONDITION COVERAGE GAPS FILLED: No token is extracted anywhere
            req.cookies = null;
            req.headers = {};

            await authenticate(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ message: "No token" });
        });

        it("should emit 401 statuses if verification resolves but active database rows return null values", async () => {
            jwt.verify.mockReturnValue({ id: "u_missing" });
            User.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue(null),
            });

            await authenticate(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ message: "User not found" });
        });

        it("should reject a soft-deleted user and report the schema role as roles[0]", async () => {
            jwt.verify.mockReturnValue({ id: "u_blocked" });
            User.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue({ _id: "u_blocked", email: "blocked@test.com", roles: ["mentor"], isDeleted: true }),
            });

            await authenticate(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ message: "User account is unavailable" });
            expect(next).not.toHaveBeenCalled();
        });

        it("should log Sentry identity using the first role in the roles array", async () => {
            const Sentry = require("@sentry/node");
            jwt.verify.mockReturnValue({ id: "u_role" });
            User.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue({ _id: "u_role", email: "mentor@test.com", roles: ["mentor"] }),
            });

            await authenticate(req, res, next);

            expect(Sentry.setUser).toHaveBeenCalledWith(expect.objectContaining({ role: "mentor" }));
            expect(logger.info).toHaveBeenCalledWith("Authenticated request", expect.objectContaining({ role: "mentor" }));
        });

        it("should log unique TokenExpiredError warning profiles and return 401 values cleanly", async () => {
            // CONDITION COVERAGE GAPS FILLED: err.name === "TokenExpiredError" evaluates to true
            const expiredError = new Error("The payload string token lifecycle signature has lapsed");
            expiredError.name = "TokenExpiredError";
            jwt.verify.mockImplementation(() => { throw expiredError; });

            await authenticate(req, res, next);

            expect(logger.warn).toHaveBeenCalledWith("Expired token used", expect.any(Object));
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ message: "Token expired" });
        });

        it("should route structural parse failure conditions into standard fallback logs states", async () => {
            // CONDITION COVERAGE GAPS FILLED: err.name === "TokenExpiredError" evaluates to false
            const randomError = new Error("Corrupted signature structural validation failure");
            jwt.verify.mockImplementation(() => { throw randomError; });

            await authenticate(req, res, next);

            expect(logger.warn).toHaveBeenCalledWith("Invalid token attempt", expect.any(Object));
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ message: "Invalid token" });
        });
    });


});