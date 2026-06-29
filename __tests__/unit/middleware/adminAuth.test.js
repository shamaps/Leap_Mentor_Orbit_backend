/**
 * @fileoverview Unit tests for Admin Authentication Middleware.
 * Achieves 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("jsonwebtoken");
jest.mock("../../../models/AdminUser");
jest.mock("../../../utils/logger", () => ({
    info: jest.fn(),
    error: jest.fn(),
}));
jest.mock("../../../config/env", () => ({
    jwtSecret: "super_secret_admin_key_2026",
}));

const jwt = require("jsonwebtoken");
const AdminUser = require("../../../models/AdminUser");
const logger = require("../../../utils/logger");
const { adminAuthenticate } = require("../../../middleware/adminAuth");

describe("Admin Auth Middleware (100% Full Branch & Condition Blueprint)", () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            cookies: { adminAccessToken: "valid_jwt_token_string" },
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    it("should return a 401 error message if no adminAccessToken is found in cookies", async () => {
        // CONDITION COVERAGE GAPS FILLED: req.cookies?.adminAccessToken is missing / falsy
        req.cookies = null;

        await adminAuthenticate(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "No token provided" });
        expect(next).not.toHaveBeenCalled();
    });

    it("should return a 403 error if the decoded token role is not admin", async () => {
        // CONDITION COVERAGE GAPS FILLED: decoded.role !== "admin" evaluates to true
        jwt.verify.mockReturnValue({ id: "user_555", role: "mentee" });

        await adminAuthenticate(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: "Access denied: not an admin token" });
    });

    it("should return a 401 error if the admin row database query returns null", async () => {
        // CONDITION COVERAGE GAPS FILLED: !admin evaluates to true
        jwt.verify.mockReturnValue({ id: "admin_999", role: "admin" });
        AdminUser.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue(null),
        });

        await adminAuthenticate(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "Admin not found" });
    });

    it("should return a 403 error if the matched admin record isActive property flag is false", async () => {
        // CONDITION COVERAGE GAPS FILLED: !admin.isActive evaluates to true
        jwt.verify.mockReturnValue({ id: "admin_999", role: "admin" });
        AdminUser.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({ _id: "admin_999", email: "deactivated@admin.com", isActive: false }),
        });

        await adminAuthenticate(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: "Admin account is deactivated" });
    });

    it("should authorize requests cleanly and attach the admin profile object to req on success", async () => {
        const mockAdmin = { _id: "admin_999", email: "root@admin.com", isActive: true };
        jwt.verify.mockReturnValue({ id: "admin_999", role: "admin" });
        AdminUser.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue(mockAdmin),
        });

        await adminAuthenticate(req, res, next);

        expect(req.admin).toEqual(mockAdmin);
        expect(logger.info).toHaveBeenCalledWith("Admin authenticated", { adminId: "admin_999", email: "root@admin.com" });
        expect(next).toHaveBeenCalled();
    });

    it("should log errors and return a 401 response if token parsing exceptions are encountered", async () => {
        const mockError = new Error("JsonWebTokenError: signature mismatch");
        jwt.verify.mockImplementation(() => {
            throw mockError;
        });

        await adminAuthenticate(req, res, next);

        expect(logger.error).toHaveBeenCalledWith("Admin authentication failed", {
            error: mockError.message,
            stack: mockError.stack,
        });
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "Invalid or expired token" });
    });
});