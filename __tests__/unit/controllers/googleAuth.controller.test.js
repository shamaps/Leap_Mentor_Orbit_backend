jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, ...data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

jest.mock("../../../utils/auth.utils", () => ({
    issueTokens: jest.fn(),
}));

const createGoogleAuthController = require("../../../controllers/googleAuth.controller");
const { ok } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");
const { issueTokens } = require("../../../utils/auth.utils");

describe("Google Auth Controller (Unit)", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = { googleAuth: jest.fn() };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createGoogleAuthController(mockService, { logger: mockLogger });

        req = { body: { credential: "valid_google_jws_token", roles: ["mentee"], termsAccepted: true } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    it("should extract credential body options, sign session token sets, and encapsulate return profiles", async () => {
        const mockUser = { _id: "google_u123", name: "Google Tester" };
        mockService.googleAuth.mockResolvedValue({ user: mockUser, isNewUser: true });
        issueTokens.mockResolvedValue("google_signed_jwt");

        await controller.googleAuth(req, res);

        expect(mockService.googleAuth).toHaveBeenCalledWith(req.body);
        expect(issueTokens).toHaveBeenCalledWith(res, "google_u123");
        expect(ok).toHaveBeenCalledWith(res, {
            message: "Google login successful",
            accessToken: "google_signed_jwt",
            user: mockUser,
            isNewUser: true,
        });
    });

    it("should securely bypass runtime failures downstream into fallback error handlers", async () => {
        const testError = new Error("Google IDP validation timeout");
        mockService.googleAuth.mockRejectedValue(testError);

        await controller.googleAuth(req, res);

        expect(handleError).toHaveBeenCalledWith(res, testError, "googleAuth.googleAuth");
    });
});