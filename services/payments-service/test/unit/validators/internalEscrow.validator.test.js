/**
 * @fileoverview Unit tests for the internal (Engagement -> Payments) escrow Joi schemas.
 */

const { holdSchema, releaseSchema, refundSlotSchema } = require("../../../src/validators/internalEscrow.validator");

const ID = (c) => c.repeat(24);

// Same options the internal routes use.
const run = (schema, payload) => schema.validate(payload, { abortEarly: false, stripUnknown: true });

describe("holdSchema", () => {
    const valid = { menteeId: ID("a"), mentorId: ID("b"), sessionRate: 100, sessionCount: 2 };

    it("should accept a complete payload", () => {
        const { error, value } = run(holdSchema, valid);

        expect(error).toBeUndefined();
        expect(value).toEqual(valid);
    });

    it("should strip unknown fields", () => {
        const { error, value } = run(holdSchema, { ...valid, isAdmin: true });

        expect(error).toBeUndefined();
        expect(value).not.toHaveProperty("isAdmin");
    });

    it.each(["menteeId", "mentorId", "sessionRate", "sessionCount"])("should require %s", (field) => {
        const payload = { ...valid };
        delete payload[field];

        const { error } = run(holdSchema, payload);

        expect(error.details.map((d) => d.path[0])).toContain(field);
    });

    it("should reject ids that are not 24-character hex strings", () => {
        expect(run(holdSchema, { ...valid, menteeId: "short" }).error).toBeDefined();
        expect(run(holdSchema, { ...valid, mentorId: "g".repeat(24) }).error).toBeDefined();
    });

    it("should reject a session rate below 1", () => {
        expect(run(holdSchema, { ...valid, sessionRate: 0.99 }).error).toBeDefined();
    });

    it("should reject a zero or fractional session count", () => {
        expect(run(holdSchema, { ...valid, sessionCount: 0 }).error).toBeDefined();
        expect(run(holdSchema, { ...valid, sessionCount: 2.5 }).error).toBeDefined();
    });
});

describe("releaseSchema", () => {
    it("should accept an empty body because menteeId is optional", () => {
        const { error, value } = run(releaseSchema, {});

        expect(error).toBeUndefined();
        expect(value).toEqual({});
    });

    it("should accept a valid menteeId", () => {
        const { error, value } = run(releaseSchema, { menteeId: ID("a") });

        expect(error).toBeUndefined();
        expect(value.menteeId).toBe(ID("a"));
    });

    it("should reject a malformed menteeId", () => {
        expect(run(releaseSchema, { menteeId: "nope" }).error).toBeDefined();
    });

    it("should strip unknown fields", () => {
        expect(run(releaseSchema, { amount: 999 }).value).toEqual({});
    });
});

describe("refundSlotSchema", () => {
    it("should default cancelledBy to system", () => {
        const { error, value } = run(refundSlotSchema, {});

        expect(error).toBeUndefined();
        expect(value).toEqual({ cancelledBy: "system" });
    });

    it("should keep a provided cancelledBy and slotId", () => {
        const { error, value } = run(refundSlotSchema, { cancelledBy: "mentee", slotId: ID("c") });

        expect(error).toBeUndefined();
        expect(value).toEqual({ cancelledBy: "mentee", slotId: ID("c") });
    });

    it("should accept a cancelledBy of exactly 80 characters and reject 81", () => {
        expect(run(refundSlotSchema, { cancelledBy: "x".repeat(80) }).error).toBeUndefined();
        expect(run(refundSlotSchema, { cancelledBy: "x".repeat(81) }).error).toBeDefined();
    });

    it("should reject a malformed slotId", () => {
        expect(run(refundSlotSchema, { slotId: "bad" }).error).toBeDefined();
    });
});