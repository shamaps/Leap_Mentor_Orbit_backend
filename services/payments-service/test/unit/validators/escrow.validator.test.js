/**
 * @fileoverview Unit tests for the public escrow Joi schemas.
 */

const { paySchema } = require("../../../src/validators/escrow.validator");

const ID = "a".repeat(24);
const valid = { connectRequestId: ID, sessionRate: 100, sessionCount: 2 };

const without = (obj, key) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
// Same options the controllers use when they validate request bodies.
const check = (payload) => paySchema.validate(payload, { abortEarly: false });
const messages = (payload) => (check(payload).error?.details ?? []).map((d) => d.message);

describe("paySchema", () => {
    it("should accept a complete, valid payload", () => {
        const { error, value } = check(valid);

        expect(error).toBeUndefined();
        expect(value).toEqual(valid);
    });

    it("should accept the minimum allowed values", () => {
        expect(check({ ...valid, sessionRate: 1, sessionCount: 1 }).error).toBeUndefined();
    });

    it("should convert numeric strings to numbers", () => {
        const { error, value } = check({ ...valid, sessionRate: "50", sessionCount: "3" });

        expect(error).toBeUndefined();
        expect(value.sessionRate).toBe(50);
        expect(value.sessionCount).toBe(3);
    });

    describe("connectRequestId", () => {
        it("should be required", () => {
            expect(messages(without(valid, "connectRequestId"))).toContain("connectRequestId is required");
        });

        it("should reject non-hex characters with the custom message", () => {
            expect(messages({ ...valid, connectRequestId: "z".repeat(24) }))
                .toContain("connectRequestId must be a valid MongoDB ObjectId");
        });

        it("should reject ids that are not 24 characters long", () => {
            expect(check({ ...valid, connectRequestId: "a".repeat(23) }).error).toBeDefined();
            expect(check({ ...valid, connectRequestId: "a".repeat(25) }).error).toBeDefined();
        });
    });

    describe("sessionRate", () => {
        it("should be required", () => {
            expect(messages(without(valid, "sessionRate"))).toContain("sessionRate is required");
        });

        it.each([0, 0.5, -10])("should reject %s as below the minimum", (sessionRate) => {
            expect(messages({ ...valid, sessionRate })).toContain("sessionRate must be at least 1");
        });

        it("should reject a non-numeric value", () => {
            expect(messages({ ...valid, sessionRate: "abc" }).join(" ")).toMatch(/sessionRate/);
        });
    });

    describe("sessionCount", () => {
        it("should be required", () => {
            expect(messages(without(valid, "sessionCount"))).toContain("sessionCount is required");
        });

        it("should reject zero and negatives with the minimum message", () => {
            expect(messages({ ...valid, sessionCount: 0 })).toContain("sessionCount must be at least 1");
            expect(messages({ ...valid, sessionCount: -2 })).toContain("sessionCount must be at least 1");
        });

        it("should reject fractional counts", () => {
            expect(messages({ ...valid, sessionCount: 1.5 }).join(" ")).toMatch(/integer/);
        });
    });

    it("should reject unknown fields so callers cannot smuggle extra data", () => {
        const { error } = check({ ...valid, commissionAmount: 0 });

        expect(error).toBeDefined();
        expect(error.details[0].message).toMatch(/not allowed/);
    });

    it("should report every problem at once when abortEarly is off", () => {
        expect(messages({})).toHaveLength(3);
    });
});