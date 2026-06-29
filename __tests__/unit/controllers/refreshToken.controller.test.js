jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, ...data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createRefreshTokenController = require("../../../controllers/refreshToken.controller");
const { ok } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Refresh Token Controller (Unit)", () => {
    let mockTokenService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockTokenService = { refresh: jest.fn(), logout: jest.fn() };
        mockLogger = { info: jest.fn(), error: jest.fn() };
        controller = createRefreshTokenController(mockTokenService, { logger: mockLogger });

        req = { cookies: { refreshToken: "mock_plain_token_string" } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            clearCookie: jest.fn(),
        };
        jest.clearAllMocks();
    });

    describe("refresh", () => {
        it("should read token cookies, invoke rotation logic, and pass envelopes into standard ok responses", async () => {
            const servicePayload = { accessToken: "new_access_jwt", user: { _id: "u1" } };
            mockTokenService.refresh.mockResolvedValue(servicePayload);

            await controller.refresh(req, res);

            expect(mockTokenService.refresh).toHaveBeenCalledWith("mock_plain_token_string", res);
            expect(ok).toHaveBeenCalledWith(res, servicePayload);
        });

        it("should channel execution crashes securely to application error utility hooks", async () => {
            const error = new Error("Crypto token breach");
            mockTokenService.refresh.mockRejectedValue(error);

            await controller.refresh(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "auth.refresh");
        });
    });

    describe("logout", () => {
        it("should trigger storage eviction, strip browser cookies records, and return success", async () => {
            mockTokenService.logout.mockResolvedValue({ message: "Logged out successfully" });

            await controller.logout(req, res);

            expect(mockTokenService.logout).toHaveBeenCalledWith("mock_plain_token_string");
            expect(res.clearCookie).toHaveBeenCalledWith("refreshToken", { path: "/" });
            expect(ok).toHaveBeenCalledWith(res, { message: "Logged out successfully" });
        });
    });
});