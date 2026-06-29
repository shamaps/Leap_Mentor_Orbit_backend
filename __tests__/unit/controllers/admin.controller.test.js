/**
 * @fileoverview Unit tests for the Admin Controller.
 * Ensures HTTP request mapping, service invocation, and standard response formatting.
 */

const createAdminController = require("../../../controllers/admin.controller");

// Mock standard response utilities
jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => ({ status: 200, data })),
    fail: jest.fn((res, msg, code) => ({ status: code, message: msg })),
    noContent: jest.fn((res) => ({ status: 204 })),
}));
jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err) => ({ status: err.statusCode || 500, error: err })),
}));

const { ok, fail, noContent } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

/**
 * Factory to create a mock Admin Service.
 * @param {Object} overrides - Specific mock implementations to override defaults.
 * @returns {Object} Mocked service object.
 */
const makeAdminService = (overrides = {}) => ({
    loginAdmin: jest.fn(),
    fetchStats: jest.fn(),
    fetchUsers: jest.fn(),
    removeUser: jest.fn(),
    blockUser: jest.fn(),
    unblockUser: jest.fn(),
    ...overrides,
});

describe("Admin Controller", () => {
    let service, controller, req, res, logger;

    beforeEach(() => {
        service = makeAdminService();
        logger = { info: jest.fn(), error: jest.fn() };
        controller = createAdminController(service, { logger });
        req = { body: {}, params: {}, query: {} };
        res = { clearCookie: jest.fn() };
        jest.clearAllMocks();
    });

    describe("adminLogin", () => {
        /**
         * @test Happy path for controller login.
         */
        it("calls service.loginAdmin and returns ok response", async () => {
            req.body = { email: "admin@leap.com", password: "pass" };
            service.loginAdmin.mockResolvedValue({ admin: { email: "admin@leap.com" } });

            await controller.adminLogin(req, res);

            expect(service.loginAdmin).toHaveBeenCalledWith(res, "admin@leap.com", "pass");
            expect(ok).toHaveBeenCalledWith(res, { admin: { email: "admin@leap.com" } });
            expect(logger.info).toHaveBeenCalled();
        });

        /**
         * @test Missing credentials validation.
         */
        it("returns fail if email or password is missing", async () => {
            req.body = { email: "admin@leap.com" }; // missing password

            await controller.adminLogin(req, res);

            expect(fail).toHaveBeenCalledWith(res, "Email and password are required.", 400);
            expect(service.loginAdmin).not.toHaveBeenCalled();
        });

        /**
         * @test Error propagation.
         */
        it("calls handleError if service throws", async () => {
            req.body = { email: "admin@leap.com", password: "pass" };
            const err = new Error("DB fail");
            service.loginAdmin.mockRejectedValue(err);

            await controller.adminLogin(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "adminLogin");
        });
    });

    describe("adminLogout", () => {
        it("clears cookie and returns ok", () => {
            controller.adminLogout(req, res);
            expect(res.clearCookie).toHaveBeenCalledWith("adminAccessToken", { path: "/" });
            expect(ok).toHaveBeenCalledWith(res, { message: "Logged out successfully" });
        });
    });

    describe("deleteUser", () => {
        it("calls service.removeUser and returns noContent", async () => {
            req.params.userId = "user123";
            service.removeUser.mockResolvedValue(true);

            await controller.deleteUser(req, res);

            expect(service.removeUser).toHaveBeenCalledWith("user123");
            expect(noContent).toHaveBeenCalledWith(res);
        });
    });
});