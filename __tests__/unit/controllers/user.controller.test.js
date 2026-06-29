const createUserController = require("../../../controllers/user.controller");
const { ok } = require("../../../utils/response");

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
}));

describe("User Controller (Unit)", () => {
    let mockLogger, controller, req, res;

    beforeEach(() => {
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createUserController({ logger: mockLogger });

        req = { user: { _id: "user_active_123", name: "Alex Code", email: "alex@orbit.com" } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    it("should output the session context attached to the authenticated request tracking frame", () => {
        controller.getMe(req, res);

        expect(mockLogger.info).toHaveBeenCalledWith("getMe completed successfully");
        expect(ok).toHaveBeenCalledWith(res, req.user);
    });
});