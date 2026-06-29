jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, ...data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

jest.mock("../../../utils/auth.utils", () => ({
    issueTokens: jest.fn(),
}));

const createLoginController = require("../../../controllers/login.controller");
const { ok } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");
const { issueTokens } = require("../../../utils/auth.utils");

describe("Login Controller (Unit)", () => {
    let mockLoginService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockLoginService = { login: jest.fn() };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createLoginController(mockLoginService, { logger: mockLogger });

        req = { body: { email: "user@test.com", password: "secure_password" } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    it("should process credentials, issue tokens, and return a standardized success payload", async () => {
        const mockUserDto = { _id: "user_007", email: "user@test.com", role: "mentee" };
        mockLoginService.login.mockResolvedValue({ user: mockUserDto });
        issueTokens.mockResolvedValue("signed_jwt_access_token");

        await controller.login(req, res);

        expect(mockLoginService.login).toHaveBeenCalledWith("user@test.com", "secure_password");
        expect(issueTokens).toHaveBeenCalledWith(res, "user_007");
        expect(ok).toHaveBeenCalledWith(res, {
            message: "Login successful",
            accessToken: "signed_jwt_access_token",
            user: mockUserDto,
            isNewUser: false,
        });
    });

    it("should catch validation and processing exceptions, forwarding them to global handles", async () => {
        const error = new Error("Authentication failure");
        mockLoginService.login.mockRejectedValue(error);

        await controller.login(req, res);

        expect(handleError).toHaveBeenCalledWith(res, error, "login.login");
    });
});