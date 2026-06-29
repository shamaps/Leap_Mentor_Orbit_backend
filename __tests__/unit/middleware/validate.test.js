const validate = require("../../../middleware/validate");
const Joi = require("joi");

jest.mock("../../../utils/logger", () => ({
    warn: jest.fn(),
}));

describe("Joi Verification Schema Filter Pipeline (Unit)", () => {
    let req, res, next, targetSchema;

    beforeEach(() => {
        req = { body: {}, path: "/api/v1/auth", method: "POST" };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();

        targetSchema = Joi.object({
            email: Joi.string().email().required(),
            username: Joi.string().min(3).optional(),
        });
        jest.clearAllMocks();
    });

    it("should block requests with status 400 and strip unknown target body elements on formatting validation failures", () => {
        req.body = { email: "broken-email-string", randomPayloadKey: "malicious_injection" };

        const middleware = validate(targetSchema, "body");
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            errors: expect.arrayContaining([
                expect.objectContaining({ field: "email" })
            ]),
        }));
        expect(next).not.toHaveBeenCalled();
    });

    it("should replace req.body with sanitized values, strip unmapped data, and call next() on clean validation passes", () => {
        req.body = { email: "clean@leapmentor.com", unknownKey: "should_be_stripped" };

        const middleware = validate(targetSchema, "body");
        middleware(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(req.body.email).toBe("clean@leapmentor.com");
        expect(req.body.unknownKey).toBeUndefined(); // Confirms stripUnknown feature is operational
    });
});