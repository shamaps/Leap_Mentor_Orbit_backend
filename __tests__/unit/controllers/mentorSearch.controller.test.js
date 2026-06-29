/**
 * @fileoverview Unit tests for Mentor Search Controller.
 * Secures 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(500).json({ error: err.message, context })),
}));

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json(data)),
}));

const createMentorSearchController = require("../../../controllers/mentorSearch.controller");
const { handleError } = require("../../../utils/appError");
const { ok } = require("../../../utils/response");

describe("Mentor Search Controller (100% Full Coverage Blueprint)", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = {
            searchMentors: jest.fn(),
            fallbackSearch: jest.fn(),
            autocompleteMentors: jest.fn(),
        };

        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createMentorSearchController(mockService, { logger: mockLogger });

        req = { query: { q: "javascript" } };
        res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

        jest.clearAllMocks();
    });

    describe("searchMentors endpoint", () => {
        it("should return results successfully when the primary search works", async () => {
            const mockData = { mentors: [], pagination: {} };
            mockService.searchMentors.mockResolvedValue(mockData);

            await controller.searchMentors(req, res);

            expect(mockService.searchMentors).toHaveBeenCalledWith(req.query);
            expect(ok).toHaveBeenCalledWith(res, mockData);
        });

        it("should fall back to regex search when the primary search throws an Atlas Search index error", async () => {
            const searchError = new Error("Atlas Search index not ready yet or $search failure");
            const fallbackData = { mentors: ["fallback_mentor"], pagination: {} };

            mockService.searchMentors.mockRejectedValue(searchError);
            mockService.fallbackSearch.mockResolvedValue(fallbackData);

            await controller.searchMentors(req, res);

            expect(mockLogger.warn).toHaveBeenCalled();
            expect(mockService.fallbackSearch).toHaveBeenCalledWith(req.query);
            expect(ok).toHaveBeenCalledWith(res, fallbackData);
        });

        it("should handle error if the fallback search also fails during cluster degradation", async () => {
            const searchError = new Error("The query contains $search keywords");
            const fallbackError = new Error("Database completely down");

            mockService.searchMentors.mockRejectedValue(searchError);
            mockService.fallbackSearch.mockRejectedValue(fallbackError);

            await controller.searchMentors(req, res);

            expect(handleError).toHaveBeenCalledWith(res, fallbackError, "mentorSearch.fallbackSearch");
        });

        it("should handle standard errors directly without shifting to regex fallback", async () => {
            const standardError = new Error("Normal runtime crash");
            mockService.searchMentors.mockRejectedValue(standardError);

            await controller.searchMentors(req, res);

            expect(handleError).toHaveBeenCalledWith(res, standardError, "mentorSearch.searchMentors");
        });
    });

    describe("autocompleteMentors endpoint", () => {
        it("should return typeahead suggestions successfully", async () => {
            const mockSuggestions = ["Alex", "Alonzo"];
            mockService.autocompleteMentors.mockResolvedValue(mockSuggestions);

            await controller.autocompleteMentors(req, res);

            expect(ok).toHaveBeenCalledWith(res, mockSuggestions);
        });

        it("should catch autocomplete processing faults cleanly", async () => {
            const error = new Error("Autocomplete read error");
            mockService.autocompleteMentors.mockRejectedValue(error);

            await controller.autocompleteMentors(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "mentorSearch.autocompleteMentors");
        });
    });
});