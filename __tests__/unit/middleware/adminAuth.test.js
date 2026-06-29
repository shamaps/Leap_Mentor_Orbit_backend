const jwt = require("jsonwebtoken");
const AdminUser = require("../../../models/AdminUser");
const { adminAuthenticate } = require("../../../middleware/adminAuth");

jest.mock("jsonwebtoken");
jest.mock("../../../models/AdminUser");
jest.mock("../../../utils/logger", () => ({
    info: jest.fn(),
    error: jest.fn(),
}));

describe("Admin Authentication Middleware (Unit)", () => {
    let req, res, next;

    beforeEach(() => {
        req = { cookies: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    it("should return status 401 if the adminAccessToken httpOnly cookie is missing", async () => {
        await adminAuthenticate(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "No token provided" });
        expect(next).not.toHaveBeenCalled();
    });

    it("should return status 403 if the token is valid but the decoded role is not admin", async () => {
        req.cookies.adminAccessToken = "valid_token_but_wrong_role";
        jwt.verify.mockReturnValue({ id: "admin_id", role: "user" });

        await adminAuthenticate(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: "Access denied: not an admin token" });
    });

    it("should return status 403 if the active admin document flag indicates deactivation", async () => {
        req.cookies.adminAccessToken = "valid_admin_token";
        jwt.verify.mockReturnValue({ id: "deactivated_admin_id", role: "admin" });

        const mockAdminDoc = { isActive: false };
        AdminUser.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue(mockAdminDoc),
        });

        await adminAuthenticate(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: "Admin account is deactivated" });
    });

    it("should attach the administrator document to req.admin and invoke next() on success", async () => {
        req.cookies.adminAccessToken = "perfectly_valid_admin_token";
        jwt.verify.mockReturnValue({ id: "active_admin_id", role: "admin" });

        const mockAdminDoc = { _id: "active_admin_id", email: "admin@leapmentor.com", isActive: true };
        AdminUser.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue(mockAdminDoc),
        });

        await adminAuthenticate(req, res, next);

        expect(req.admin).toBe(mockAdminDoc);
        expect(next).toHaveBeenCalledTimes(1);
    });
});