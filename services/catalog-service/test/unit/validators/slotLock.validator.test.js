/**
 * @fileoverview Unit tests for the slot lock / unlock Joi schemas.
 */

const { lockSlotSchema, unlockSlotSchema } = require("../../../src/validators/slotLock.validator");
const without = (obj, key) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
const valid = {
    mentorId: "a".repeat(24),
    date: "2026-11-02",
    startTime: "09:00",
    endTime: "10:00",
};

describe.each([
    ["lockSlotSchema", lockSlotSchema],
    ["unlockSlotSchema", unlockSlotSchema],
])("%s", (_name, schema) => {
    const check = (payload) => schema.validate(payload, { abortEarly: false });
    const messages = (payload) => (check(payload).error?.details ?? []).map((d) => d.message);

    it("should accept a complete, valid payload unchanged", () => {
        const { error, value } = check(valid);

        expect(error).toBeUndefined();
        expect(value).toEqual(valid);
    });

    it.each(["mentorId", "date", "startTime", "endTime"])("should require %s", (field) => {
        

        expect(messages(without(valid, field))).toContain(`"${field}" is required`);
    });

    describe("mentorId", () => {
        it("should accept upper- and lower-case hexadecimal ids", () => {
            expect(check({ ...valid, mentorId: "ABCDEF0123456789abcdef01" }).error).toBeUndefined();
        });

        it("should reject non-hex characters", () => {
            expect(check({ ...valid, mentorId: "z".repeat(24) }).error).toBeDefined();
        });

        it("should reject ids that are not exactly 24 characters", () => {
            expect(messages({ ...valid, mentorId: "a".repeat(23) })).toContain('"mentorId" length must be 24 characters long');
            expect(messages({ ...valid, mentorId: "a".repeat(25) })).toContain('"mentorId" length must be 24 characters long');
        });

        it("should reject an empty string", () => {
            expect(check({ ...valid, mentorId: "" }).error).toBeDefined();
        });
    });

    describe("date", () => {
        it.each(["2026/11/02", "02-11-2026", "2026-1-2", "tomorrow", ""])("should reject the malformed date %j", (date) => {
            expect(check({ ...valid, date }).error).toBeDefined();
        });
    });

    describe("startTime and endTime", () => {
        it.each(["9:00", "09:0", "0900", "09-00", "nine", ""])("should reject the malformed time %j", (time) => {
            expect(check({ ...valid, startTime: time }).error).toBeDefined();
            expect(check({ ...valid, endTime: time }).error).toBeDefined();
        });
    });

    it("should reject unknown fields", () => {
        const { error } = check({ ...valid, menteeId: "b".repeat(24) });

        expect(error).toBeDefined();
        expect(error.details[0].message).toBe('"menteeId" is not allowed');
    });

    it("should report every problem at once when abortEarly is off", () => {
        expect(messages({})).toHaveLength(4);
    });
});

describe("lock and unlock schemas", () => {
    it("should currently accept and reject the same payloads", () => {
        const payloads = [valid, {}, { ...valid, date: "bad" }, { ...valid, mentorId: "short" }];

        for (const payload of payloads) {
            expect(Boolean(lockSlotSchema.validate(payload).error)).toBe(Boolean(unlockSlotSchema.validate(payload).error));
        }
    });
});
