const jwt = require("jsonwebtoken");
const { mockRes, mockReq } = require("../helpers");

jest.mock("../../utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock("@sentry/node", () => ({ setUser: jest.fn(), captureException: jest.fn() }));
jest.mock("../../models/AdminUser", () => ({ findById: jest.fn() }));

const AdminUser = require("../../models/AdminUser");
const config = require("../../config/env");
const { adminAuthenticate, requireSuperAdmin } = require("../../middleware/adminAuth");

const adminId = "64b7f0c2a1b2c3d4e5f60999";
const adminToken = (payload = { id: adminId, role: "admin" }, opts = {}) =>
    jwt.sign(payload, config.jwtSecret, { expiresIn: "5m", ...opts });
const mockAdminLookup = (result) => AdminUser.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(result) });

const run = async (req) => {
    const res = mockRes();
    const next = jest.fn();
    await adminAuthenticate(req, res, next);
    return { res, next };
};

describe("adminAuthenticate", () => {
    test("401 when the adminAccessToken cookie is missing", async () => {
        const { res, next } = await run(mockReq());
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "No token provided" });
        expect(next).not.toHaveBeenCalled();
    });

    test("does NOT accept an admin token from the Authorization header (cookie only)", async () => {
        const { res, next } = await run(mockReq({ headers: { authorization: `Bearer ${adminToken()}` } }));
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test("does NOT accept a normal user's accessToken cookie", async () => {
        const { res, next } = await run(mockReq({ cookies: { accessToken: adminToken() } }));
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test("loads the admin without the password hash and attaches req.admin", async () => {
        const select = jest.fn().mockResolvedValue({ _id: adminId, email: "root@leapmentor.com", isActive: true });
        AdminUser.findById.mockReturnValue({ select });
        const req = mockReq({ cookies: { adminAccessToken: adminToken() } });

        const { next, res } = await run(req);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
        expect(AdminUser.findById).toHaveBeenCalledWith(adminId);
        expect(select).toHaveBeenCalledWith("-password");
        expect(req.admin).toMatchObject({ _id: adminId });
    });

    test("403 when a valid, signed token does not carry the admin role (e.g. a mentee token)", async () => {
        const { res, next } = await run(mockReq({ cookies: { adminAccessToken: adminToken({ id: adminId, role: "mentee" }) } }));
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: "Access denied: not an admin token" });
        expect(next).not.toHaveBeenCalled();
        expect(AdminUser.findById).not.toHaveBeenCalled();
    });

    test("401 when the admin no longer exists", async () => {
        mockAdminLookup(null);
        const { res } = await run(mockReq({ cookies: { adminAccessToken: adminToken() } }));
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "Admin not found" });
    });

    test("403 when the admin account is deactivated", async () => {
        mockAdminLookup({ _id: adminId, isActive: false });
        const { res, next } = await run(mockReq({ cookies: { adminAccessToken: adminToken() } }));
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: "Admin account is deactivated" });
        expect(next).not.toHaveBeenCalled();
    });

    test.each([
        ["expired", () => adminToken({ id: adminId, role: "admin" }, { expiresIn: -10 })],
        ["malformed", () => "not.a.jwt"],
        ["signed with another secret", () => jwt.sign({ id: adminId, role: "admin" }, "other")],
    ])("401 for a %s token", async (_n, makeToken) => {
        const { res, next } = await run(mockReq({ cookies: { adminAccessToken: makeToken() } }));
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "Invalid or expired token" });
        expect(next).not.toHaveBeenCalled();
    });

    test("401 on a CastError from a bad id inside the token", async () => {
        AdminUser.findById.mockReturnValue({ select: jest.fn().mockRejectedValue(Object.assign(new Error("cast"), { name: "CastError" })) });
        const { res } = await run(mockReq({ cookies: { adminAccessToken: adminToken({ id: "x", role: "admin" }) } }));
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test("503 on a database failure (not a misleading 401)", async () => {
        AdminUser.findById.mockReturnValue({ select: jest.fn().mockRejectedValue(new Error("db down")) });
        const { res, next } = await run(mockReq({ cookies: { adminAccessToken: adminToken() } }));
        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith({ message: "Authentication service unavailable" });
        expect(next).not.toHaveBeenCalled();
    });
});

describe("requireSuperAdmin", () => {
    const run = (admin) => {
        const req = mockReq({ admin });
        const res = mockRes();
        const next = jest.fn();
        requireSuperAdmin(req, res, next);
        return { res, next };
    };

    test("allows a super admin", () => {
        const { next, res } = run({ _id: adminId, isSuperAdmin: true });
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    test.each([
        ["a regular admin", { _id: adminId, isSuperAdmin: false }],
        ["an admin with the flag unset", { _id: adminId }],
        ["no admin at all (middleware ran out of order)", undefined],
    ])("403 for %s", (_n, admin) => {
        const { res, next } = run(admin);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: "Access denied: super admin only" });
        expect(next).not.toHaveBeenCalled();
    });
});
