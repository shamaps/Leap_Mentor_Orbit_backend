jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createImageController = require("../../../controllers/image.controller");
const { ok } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Image Controller (Unit)", () => {
    let mockImageService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockImageService = { getProfileImageUrl: jest.fn() };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createImageController(mockImageService, { logger: mockLogger });

        req = { params: { userId: "user_123" }, query: { w: "150", h: "150" } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    it("should parse route and query parameter variables and return a 200 payload envelope on success", () => {
        const servicePayload = { url: "https://cloudinary.com/image.jpg", width: 150, height: 150 };
        mockImageService.getProfileImageUrl.mockReturnValue(servicePayload);

        controller.getProfileImage(req, res);

        expect(mockImageService.getProfileImageUrl).toHaveBeenCalledWith("user_123", req.query);
        expect(ok).toHaveBeenCalledWith(res, servicePayload);
    });

    it("should catch internal execution errors and route them to application error utility handlers", () => {
        const testError = new Error("Transformation engine crash");
        mockImageService.getProfileImageUrl.mockImplementation(() => { throw testError; });

        controller.getProfileImage(req, res);

        expect(handleError).toHaveBeenCalledWith(res, testError, "image.getProfileImage");
    });
});