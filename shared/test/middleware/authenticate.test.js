const jwt = require("jsonwebtoken");
const { mockRes, mockReq } = require("../helpers");

jest.mock("../../utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock("@sentry/node", () => ({ setUser: jest.fn(), captureException: jest.fn() }));
jest.mock("../../models/User", () => ({ findById: jest.fn() }));

const Sentry = require("@sentry/node");
const User = require("../../models/User");
const config = require("../../config/env");
const { PERMISSIONS } = require("../../config/permissions");
const { authenticate, requirePermission } = require("../../middleware/authenticate");

const userId = "64b7f0c2a1b2c3d4e5f60718";
const sign = (payload = { id: userId }, opts = {}) => jwt.sign(payload, config.jwtSecret, { expiresIn: "5m", ...opts });
const userDoc = (overrides = {}) => ({ _id: userId, email: "nehal@yopmail.com", roles: ["mentee"], isDeleted: false, ...overrides });
const mockUserLookup = (result) => User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(result) });

const run = async (req) => {
    const res = mockRes();
    const next = jest.fn();
    await authenticate(req, res, next);
    return { res, next };
};

describe("authenticate", () => {
    test("401 'No token' when neither a cookie nor an Authorization header is present", async () => {
        const { res, next } = await run(mockReq());
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "No token" });
        expect(next).not.toHaveBeenCalled();
        expect(User.findById).not.toHaveBeenCalled();
    });

    test("accepts a Bearer token from the Authorization header", async () => {
        mockUserLookup(userDoc());
        const req = mockReq({ headers: { authorization: `Bearer ${sign()}` } });
        const { next, res } = await run(req);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
        expect(req.user).toMatchObject({ _id: userId });
        expect(User.findById).toHaveBeenCalledWith(userId);
    });

    test("accepts the accessToken cookie, and prefers it over the header", async () => {
        mockUserLookup(userDoc());
        const req = mockReq({
            cookies: { accessToken: sign({ id: userId }) },
            headers: { authorization: "Bearer not-a-valid-token" },
        });
        const { next } = await run(req);
        expect(next).toHaveBeenCalledTimes(1);
    });

    test("never loads the password hash", async () => {
        const select = jest.fn().mockResolvedValue(userDoc());
        User.findById.mockReturnValue({ select });
        await run(mockReq({ cookies: { accessToken: sign() } }));
        expect(select).toHaveBeenCalledWith("-password");
    });

    test("tags Sentry with the user's id and role but a masked email", async () => {
        mockUserLookup(userDoc({ roles: ["mentor", "mentee"] }));
        await run(mockReq({ cookies: { accessToken: sign() } }));
        expect(Sentry.setUser).toHaveBeenCalledWith({ id: userId, email: "ne***@yopmail.com", role: "mentor" });
    });

    test("401 'Token expired' for an expired token", async () => {
        const token = sign({ id: userId }, { expiresIn: -10 });
        const { res, next } = await run(mockReq({ cookies: { accessToken: token } }));
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "Token expired" });
        expect(next).not.toHaveBeenCalled();
    });

    test.each([
        ["malformed token", "garbage.token.here"],
        ["token signed with another secret", jwt.sign({ id: userId }, "other-secret")],
    ])("401 'Invalid token' for a %s", async (_n, token) => {
        const { res, next } = await run(mockReq({ cookies: { accessToken: token } }));
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "Invalid token" });
        expect(next).not.toHaveBeenCalled();
    });

    test("rejects an unsigned token (alg: none)", async () => {
        const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ id: userId })).toString("base64url")}.`;
        const { res, next } = await run(mockReq({ cookies: { accessToken: none } }));
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test("401 'Invalid token' when the id inside the token cannot be cast (CastError)", async () => {
        User.findById.mockReturnValue({ select: jest.fn().mockRejectedValue(Object.assign(new Error("Cast to ObjectId failed"), { name: "CastError" })) });
        const { res } = await run(mockReq({ cookies: { accessToken: sign({ id: "not-an-object-id" }) } }));
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "Invalid token" });
    });

    test("401 'User not found' when the token is valid but the user no longer exists", async () => {
        mockUserLookup(null);
        const { res, next } = await run(mockReq({ cookies: { accessToken: sign() } }));
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "User not found" });
        expect(next).not.toHaveBeenCalled();
    });

    test("401 for a soft-deleted user, so a deleted account's old tokens stop working", async () => {
        mockUserLookup(userDoc({ isDeleted: true }));
        const req = mockReq({ cookies: { accessToken: sign() } });
        const { res, next } = await run(req);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "User account is unavailable" });
        expect(next).not.toHaveBeenCalled();
        expect(req.user).toBeUndefined();
    });

    test("a database failure is OUR problem: 503 (not 401), reported to Sentry", async () => {
        const dbError = new Error("connection refused");
        User.findById.mockReturnValue({ select: jest.fn().mockRejectedValue(dbError) });
        const { res, next } = await run(mockReq({ cookies: { accessToken: sign() } }));
        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith({ message: "Authentication service unavailable" });
        expect(Sentry.captureException).toHaveBeenCalledWith(dbError);
        expect(next).not.toHaveBeenCalled();
    });
});

describe("requirePermission", () => {
    const run = (permissions, user) => {
        const req = mockReq({ user });
        const res = mockRes();
        const next = jest.fn();
        requirePermission(...permissions)(req, res, next);
        return { res, next };
    };

    test("calls next() when the user's role grants the permission", () => {
        const { next, res } = run([PERMISSIONS.BOOK_SESSION], { _id: userId, roles: ["mentee"] });
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    test("403 when the role lacks it", () => {
        const { res, next } = run([PERMISSIONS.WITHDRAW_EARNINGS], { _id: userId, roles: ["mentee"], email: "a@b.com" });
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: "Access denied: insufficient permission" });
        expect(next).not.toHaveBeenCalled();
    });

    test("any one of several permissions is enough", () => {
        const { next } = run([PERMISSIONS.WITHDRAW_EARNINGS, PERMISSIONS.BOOK_SESSION], { roles: ["mentee"] });
        expect(next).toHaveBeenCalled();
    });

    test("403 when there is no user, no roles, or an empty permission list", () => {
        expect(run([PERMISSIONS.BOOK_SESSION], undefined).res.status).toHaveBeenCalledWith(403);
        expect(run([PERMISSIONS.BOOK_SESSION], { roles: [] }).res.status).toHaveBeenCalledWith(403);
        expect(run([], { roles: ["mentee"] }).res.status).toHaveBeenCalledWith(403);
    });

    test("a user with both roles gets the union of their permissions", () => {
        const user = { roles: ["mentor", "mentee"] };
        expect(run([PERMISSIONS.WITHDRAW_EARNINGS], user).next).toHaveBeenCalled();
        expect(run([PERMISSIONS.BOOK_SESSION], user).next).toHaveBeenCalled();
    });
});
