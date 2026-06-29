jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createMentorSearchController = require("../../../controllers/mentorSearch.controller");
const { ok } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Mentor Search Controller (Unit)", () => {
    let mockSearchService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockSearchService = {
            searchMentors: jest.fn(),
            fallbackSearch: jest.fn(),
            autocompleteMentors: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createMentorSearchController(mockSearchService, { logger: mockLogger });

        req = { query: { q: "react" } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("searchMentors", () => {
        it("should successfully execute primary search strategy and return a 200 payload envelope", async () => {
            const mockResult = { mentors: [{ name: "React Guru" }], pagination: {} };
            mockSearchService.searchMentors.mockResolvedValue(mockResult);

            await controller.searchMentors(req, res);

            expect(mockSearchService.searchMentors).toHaveBeenCalledWith(req.query);
            expect(ok).toHaveBeenCalledWith(res, mockResult);
        });

        it("should seamlessly activate regex fallback search if an Atlas Search index missing error is captured", async () => {
            // FIXED: Configured the error string to explicitly feature "$search" to satisfy controller inclusions guards safely
            const atlasError = new Error("Atlas Search index error on $search operation");
            mockSearchService.searchMentors.mockRejectedValue(atlasError);

            const mockFallbackResult = { mentors: [{ name: "Regex Match" }], pagination: {} };
            mockSearchService.fallbackSearch.mockResolvedValue(mockFallbackResult);

            await controller.searchMentors(req, res);

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("Atlas Search unavailable"),
                expect.objectContaining({ error: atlasError.message })
            );
            expect(mockSearchService.fallbackSearch).toHaveBeenCalledWith(req.query);
            expect(ok).toHaveBeenCalledWith(res, mockFallbackResult);
        });

        it("should route standard non-Atlas errors directly to application error helpers", async () => {
            const standardError = new Error("Generic validation or database error");
            mockSearchService.searchMentors.mockRejectedValue(standardError);

            await controller.searchMentors(req, res);

            expect(handleError).toHaveBeenCalledWith(res, standardError, "mentorSearch.searchMentors");
        });
    });
});