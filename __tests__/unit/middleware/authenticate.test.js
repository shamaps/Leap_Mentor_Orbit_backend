const jwt = require("jsonwebtoken");
const User = require("../../../models/User");
const { authenticate, requireRole } = require("../../../middleware/authenticate");

jest.mock("jsonwebtoken");
jest.mock("../../../models/User");
jest.mock("@sentry/node", () => ({
    setUser: jest.fn(),
}));
jest.mock("../../../utils/logger", () => ({
    info: jest.fn(),
    warn: jest.fn(),
}));

describe("User Authentication & requireRole Middleware (Unit)", () => {
    let req, res, next;

    beforeEach(() => {
        req = { cookies: {}, headers: {}, path: "/api/v1/test", method: "GET" };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    describe("authenticate", () => {
        it("should return status 401 with Token expired message if jwt throws a TokenExpiredError", async () => {
            req.cookies.accessToken = "expired_cookie_token";
            const expiredError = new Error("jwt expired");
            expiredError.name = "TokenExpiredError";
            jwt.verify.mockImplementation(() => { throw expiredError; });

            await authenticate(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ message: "Token expired" });
        });

        it("should authorize the request and bind req.user using either cookie or authorization bearer tokens", async () => {
            req.headers.authorization = "Bearer explicit_jwt_token";
            jwt.verify.mockReturnValue({ id: "standard_user_id" });

            const mockUserDoc = { _id: "standard_user_id", email: "user@test.com", role: "mentor", roles: ["mentor"] };
            User.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockUserDoc),
            });

            await authenticate(req, res, next);

            expect(req.user).toBe(mockUserDoc);
            expect(next).toHaveBeenCalledTimes(1);
        });
    });

    describe("requireRole", () => {
        it("should allow request execution path continuity if the user contains an appropriate role", () => {
            req.user = { roles: ["mentee"] };

            const middleware = requireRole("mentor", "mentee");
            middleware(req, res, next);

            expect(next).toHaveBeenCalledTimes(1);
            expect(res.status).not.toHaveBeenCalled();
        });

        it("should intercept and drop requests with status 403 if the user does not possess matching required roles", () => {
            req.user = { roles: ["user"] };

            const middleware = requireRole("admin");
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ message: "Access denied: insufficient role" });
            expect(next).not.toHaveBeenCalled();
        });
    });
});