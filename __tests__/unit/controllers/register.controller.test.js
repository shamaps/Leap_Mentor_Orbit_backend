jest.mock("../../../utils/response", () => ({
    created: jest.fn((res, data) => res.status(201).json({ success: true, data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createRegisterController = require("../../../controllers/register.controller");
const { created } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Register Controller (Unit)", () => {
    let mockRegisterService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockRegisterService = { register: jest.fn() };
        mockLogger = { info: jest.fn(), error: jest.fn() };
        controller = createRegisterController(mockRegisterService, { logger: mockLogger });

        req = { body: { name: "Alice", email: "alice@test.com", password: "password123", roles: ["mentee"], termsAccepted: true } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    it("should process inbound payloads, forward the response pipe for cookie setup, and return 201 on success", async () => {
        const successPayload = { message: "Registered successfully", accessToken: "signed_jwt", user: { _id: "u1" }, isNewUser: true };
        mockRegisterService.register.mockResolvedValue(successPayload);

        await controller.register(req, res);

        expect(mockRegisterService.register).toHaveBeenCalledWith(res, req.body);
        expect(created).toHaveBeenCalledWith(res, successPayload);
    });

    it("should catch internal processing errors and safely pass them to global application error utility hooks", async () => {
        const serviceError = new Error("Wallet initialization timeout");
        mockRegisterService.register.mockRejectedValue(serviceError);

        await controller.register(req, res);

        expect(handleError).toHaveBeenCalledWith(res, serviceError, "register.register");
    });
});