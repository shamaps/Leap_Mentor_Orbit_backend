/**
 * @fileoverview Unit tests for the Admin Verification Controller.
 * Verifies HTTP status response structures, controller routing, and error branches.
 */

// 1. Mock dependencies at the EXACT path your controller imports them from
jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json(data)),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ error: err.message, context })),
}));

const createAdminVerificationController = require("../../../controllers/adminVerification.controller");
const { ok } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("AdminVerification Controller", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = {
            getAllMentorVerifications: jest.fn(),
            getMentorVerificationById: jest.fn(),
            verifyMentor: jest.fn(),
            revokeMentorVerification: jest.fn(),
        };
        mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
        controller = createAdminVerificationController(mockService, { logger: mockLogger });

        req = { query: {}, params: {}, body: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("getAllMentorVerifications", () => {
        it("should successfully return a list of mentor verifications", async () => {
            req.query = { page: "1", limit: "10", search: "test" };
            const mockData = { mentors: [], pagination: {} };
            mockService.getAllMentorVerifications.mockResolvedValue(mockData);

            await controller.getAllMentorVerifications(req, res);

            expect(mockService.getAllMentorVerifications).toHaveBeenCalledWith({ page: "1", limit: "10", search: "test" });
            expect(mockLogger.info).toHaveBeenCalledWith("getAllMentorVerifications completed successfully");
            expect(ok).toHaveBeenCalledWith(res, mockData);
        });

        it("should call handleError when the service throws an error", async () => {
            const testError = new Error("Service down");
            mockService.getAllMentorVerifications.mockRejectedValue(testError);

            await controller.getAllMentorVerifications(req, res);

            expect(handleError).toHaveBeenCalledWith(res, testError, "getAllMentorVerifications");
        });
    });

    describe("getMentorVerificationById", () => {
        it("should return verification details for a given mentor ID", async () => {
            req.params.mentorProfileId = "m123";
            const mockData = { user: {}, mentorProfile: {} };
            mockService.getMentorVerificationById.mockResolvedValue(mockData);

            await controller.getMentorVerificationById(req, res);

            expect(mockService.getMentorVerificationById).toHaveBeenCalledWith("m123");
            expect(ok).toHaveBeenCalledWith(res, mockData);
        });

        it("should catch errors using handleError on failure", async () => {
            const testError = new Error("Not Found");
            mockService.getMentorVerificationById.mockRejectedValue(testError);

            await controller.getMentorVerificationById(req, res);

            expect(handleError).toHaveBeenCalledWith(res, testError, "getMentorVerificationById");
        });
    });

    describe("verifyMentor", () => {
        it("should successfully verify a mentor profile", async () => {
            req.params.mentorProfileId = "m123";
            const mockResult = { message: "Verified" };
            mockService.verifyMentor.mockResolvedValue(mockResult);

            await controller.verifyMentor(req, res);

            expect(mockService.verifyMentor).toHaveBeenCalledWith("m123");
            expect(ok).toHaveBeenCalledWith(res, mockResult);
        });

        it("should forward errors to helper when verification fails", async () => {
            const testError = new Error("Invalid operational state");
            mockService.verifyMentor.mockRejectedValue(testError);

            await controller.verifyMentor(req, res);

            expect(handleError).toHaveBeenCalledWith(res, testError, "verifyMentor");
        });
    });

    describe("revokeMentorVerification", () => {
        it("should successfully revoke a verification profile", async () => {
            req.params.mentorProfileId = "m123";
            const mockResult = { message: "Revoked" };
            mockService.revokeMentorVerification.mockResolvedValue(mockResult);

            await controller.revokeMentorVerification(req, res);

            expect(mockService.revokeMentorVerification).toHaveBeenCalledWith("m123");
            expect(ok).toHaveBeenCalledWith(res, mockResult);
        });

        it("should capture and process service errors seamlessly", async () => {
            const testError = new Error("Revocation failure");
            mockService.revokeMentorVerification.mockRejectedValue(testError);

            await controller.revokeMentorVerification(req, res);

            expect(handleError).toHaveBeenCalledWith(res, testError, "revokeMentorVerification");
        });
    });
});