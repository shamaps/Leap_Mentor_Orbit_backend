jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createMentorReferController = require("../../../controllers/mentorRefer.controller");
const { ok } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Mentor Referral Controller (Unit)", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = { getSimilarMentors: jest.fn() };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createMentorReferController(mockService, { logger: mockLogger });

        req = { params: { id: "req_xyz_123" }, user: { _id: "mentor_host_555" } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    it("should process routing keys, extract the user session context, and deliver 200 payload maps", async () => {
        const mockDashboard = { mentors: [], mySkills: ["Node.js"] };
        mockService.getSimilarMentors.mockResolvedValue(mockDashboard);

        await controller.getSimilarMentors(req, res);

        expect(mockService.getSimilarMentors).toHaveBeenCalledWith("req_xyz_123", "mentor_host_555");
        expect(ok).toHaveBeenCalledWith(res, mockDashboard);
    });

    it("should bubble unexpected exceptions to fallback application error utilities", async () => {
        const testError = new Error("Data serialization breakdown");
        mockService.getSimilarMentors.mockRejectedValue(testError);

        await controller.getSimilarMentors(req, res);

        expect(handleError).toHaveBeenCalledWith(res, testError, "mentorRefer.getSimilarMentors");
    });
});