jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

jest.mock("../../../utils/auth.utils", () => ({
    issueTokens: jest.fn(),
}));

const createClerkSSOController = require("../../../controllers/clerkSSO.controller");
const { ok } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");
const { issueTokens } = require("../../../utils/auth.utils");

describe("Clerk SSO Controller (Unit)", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = { clerkSSO: jest.fn() };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createClerkSSOController(mockService, { logger: mockLogger });

        req = { body: { clerkToken: "valid_token" } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    it("should process SSO request body data, sign tokens, and structure return payloads", async () => {
        const mockUser = { _id: "user_abc_123", name: "SSO User" };
        mockService.clerkSSO.mockResolvedValue({ user: mockUser, isNewUser: true });
        issueTokens.mockResolvedValue("signed_access_token");

        await controller.clerkSSO(req, res);

        expect(mockService.clerkSSO).toHaveBeenCalledWith(req.body);
        expect(issueTokens).toHaveBeenCalledWith(res, "user_abc_123");
        expect(ok).toHaveBeenCalledWith(res, {
            message: "SSO login successful",
            accessToken: "signed_access_token",
            user: mockUser,
        });
    });

    it("should funnel execution errors into the application fallback middleware system", async () => {
        const testError = new Error("Clerk infrastructure drop");
        mockService.clerkSSO.mockRejectedValue(testError);

        await controller.clerkSSO(req, res);

        expect(handleError).toHaveBeenCalledWith(res, testError, "clerkSSO.clerkSSO");
    });
});