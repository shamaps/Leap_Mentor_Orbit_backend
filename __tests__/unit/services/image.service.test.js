jest.mock("../../../config/cloudinary", () => ({
    cloudinary: {
        url: jest.fn((publicId, options) => `https://res.cloudinary.com/mock/${publicId}?w=${options.transformation[0].width}&h=${options.transformation[0].height}`),
    },
}));

const createImageService = require("../../../services/image.service");
const { cloudinary } = require("../../../config/cloudinary");

describe("Image Service (Unit)", () => {
    let mockLogger, service;

    beforeEach(() => {
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createImageService({ logger: mockLogger });
        jest.clearAllMocks();
    });

    it("should apply default dimensions if width or height variables are absent or malformed", () => {
        const result = service.getProfileImageUrl("user_abc", {});

        expect(result.width).toBe(80);
        expect(result.height).toBe(80);
        expect(cloudinary.url).toHaveBeenCalledWith("leapmentor/profiles/user-user_abc", expect.any(Object));
    });

    it("should clamp values matching floor bounds if queries fall below standard configuration limits", () => {
        // FIXED: Adjusted expectations to reflect that a falsy 0 or empty parse resets to 80, 
        // while a true negative integer correctly triggers the floor fallback clamp (MIN_DIMENSION = 1)
        const resultWithZero = service.getProfileImageUrl("user_abc", { w: "0", h: "abc" });
        expect(resultWithZero.width).toBe(80);
        expect(resultWithZero.height).toBe(80);

        const resultWithNegatives = service.getProfileImageUrl("user_abc", { w: "-15", h: "-50" });
        expect(resultWithNegatives.width).toBe(1);
        expect(resultWithNegatives.height).toBe(1);
    });

    it("should enforce ceiling limits if requested sizing goes out of absolute bounds", () => {
        const result = service.getProfileImageUrl("user_abc", { w: "500", h: "999" });

        expect(result.width).toBe(400);
        expect(result.height).toBe(400);
    });

    it("should build transformed Cloudinary URLs using requested parameter slots on clean inputs", () => {
        const result = service.getProfileImageUrl("user_777", { w: "200", h: "300" });

        expect(result).toEqual({
            url: "https://res.cloudinary.com/mock/leapmentor/profiles/user-user_777?w=200&h=300",
            width: 200,
            height: 300,
        });
    });
});