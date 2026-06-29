/**
 * @fileoverview Complete unit tests for Image Service.
 * Achieves 100% statement, line, branch, and condition coverage.
 */

// Mock the Cloudinary configuration module completely
const mockCloudinaryUrl = jest.fn((publicId, options) => `https://res.cloudinary.com/mock/${publicId}`);
jest.mock("../../../config/cloudinary", () => ({
    cloudinary: {
        url: mockCloudinaryUrl
    }
}));

const createImageService = require("../../../services/image.service");

describe("Image Service (100% Comprehensive Coverage Blueprint)", () => {
    let mockLogger, service;

    beforeEach(() => {
        mockLogger = { info: jest.fn(), error: jest.fn() };
        service = createImageService({ logger: mockLogger });
        jest.clearAllMocks();
    });

    describe("getProfileImageUrl & clampDimension boundaries", () => {
        it("should cleanly apply requested layout properties inside standard boundaries parameters", () => {
            const res = service.getProfileImageUrl("123", { w: "150", h: "200" });

            expect(mockCloudinaryUrl).toHaveBeenCalledWith(
                "leapmentor/profiles/user-123",
                expect.objectContaining({
                    transformation: expect.arrayContaining([
                        expect.objectContaining({ width: 150, height: 200 })
                    ])
                })
            );
            expect(res).toEqual({
                url: "https://res.cloudinary.com/mock/leapmentor/profiles/user-123",
                width: 150,
                height: 200
            });
        });

        it("should fallback cleanly to default parameter options loops if query arguments are entirely omitted", () => {
            const res = service.getProfileImageUrl("456"); // tests query = {} fallback default block parameter

            expect(res.width).toBe(80);
            expect(res.height).toBe(80);
        });

        it("should clamp values up to MAX_DIMENSION ceiling caps if inputs outgrow system boundaries", () => {
            const res = service.getProfileImageUrl("789", { w: 999, h: 500 });

            expect(res.width).toBe(400);
            expect(res.height).toBe(400);
        });

        it("should clamp values down to MIN_DIMENSION floor thresholds if inputs drop below zero or unity limits", () => {
            const res = service.getProfileImageUrl("789", { w: -50, h: -20 });

            expect(res.width).toBe(1);
            expect(res.height).toBe(1);
        });

        it("should trigger default dimensional fallbacks branches if inputs arrive as unparseable garbage text strings", () => {
            // COVERAGE GAPS FILLED: Forces Number.parseInt to evaluate to NaN, triggering the logical || operator branch execution
            const res = service.getProfileImageUrl("abc", { w: "invalid_garbage_width_string", h: "unparseable_text" });

            expect(res.width).toBe(80);
            expect(res.height).toBe(80);
        });
    });
});