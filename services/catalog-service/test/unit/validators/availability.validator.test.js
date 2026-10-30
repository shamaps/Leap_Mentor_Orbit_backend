/**
 * @fileoverview Unit tests for the availability Joi schema.
 */

const { saveAvailabilitySchema } = require("../../../src/validators/availability.validator");

const slot = { startTime: "09:00", endTime: "10:00" };
const valid = {
    timezone: "Asia/Kolkata",
    sessionDurations: [30, 60],
    specificDates: [{ date: "2026-11-02", slots: [slot] }],
};

const without = (obj, key) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
const check = (payload) => saveAvailabilitySchema.validate(payload, { abortEarly: false });
const messages = (payload) => (check(payload).error?.details ?? []).map((d) => d.message);

describe("saveAvailabilitySchema", () => {
    it("should accept a complete, valid payload unchanged", () => {
        const { error, value } = check(valid);

        expect(error).toBeUndefined();
        expect(value).toEqual(valid);
    });

    it("should accept an empty specificDates array so a mentor can clear their calendar", () => {
        expect(check({ ...valid, specificDates: [] }).error).toBeUndefined();
    });

    it("should accept several dates with several slots each", () => {
        const payload = {
            ...valid,
            specificDates: [
                { date: "2026-11-02", slots: [slot, { startTime: "11:00", endTime: "12:00" }] },
                { date: "2026-11-03", slots: [slot] },
            ],
        };

        expect(check(payload).error).toBeUndefined();
    });

    describe("timezone", () => {
        it("should be required", () => {
            expect(messages(without(valid, "timezone"))).toContain('"timezone" is required');
        });

        it("should reject an empty string", () => {
            expect(messages({ ...valid, timezone: "" })).toContain('"timezone" is not allowed to be empty');
        });

        it("should reject a non-string value", () => {
            expect(check({ ...valid, timezone: 5 }).error).toBeDefined();
        });
    });

    describe("sessionDurations", () => {
        it("should be required", () => {
            expect(messages(without(valid, "sessionDurations"))).toContain('"sessionDurations" is required');
        });

        it.each([[[30]], [[60]], [[90]], [[30, 60, 90]]])("should accept %j", (sessionDurations) => {
            expect(check({ ...valid, sessionDurations }).error).toBeUndefined();
        });

        it.each([[[45]], [[0]], [[120]], [[30, 45]]])("should reject %j because only 30, 60 and 90 are allowed", (sessionDurations) => {
            expect(check({ ...valid, sessionDurations }).error).toBeDefined();
        });

        it("should reject an empty array", () => {
            expect(messages({ ...valid, sessionDurations: [] })).toContain('"sessionDurations" must contain at least 1 items');
        });

        it("should convert numeric strings to numbers", () => {
            const { error, value } = check({ ...valid, sessionDurations: ["30", "60"] });

            expect(error).toBeUndefined();
            expect(value.sessionDurations).toEqual([30, 60]);
        });
    });

    describe("specificDates", () => {
        it("should be required", () => {
            expect(messages(without(valid, "specificDates"))).toContain('"specificDates" is required');
        });

        it("should require a date on every entry", () => {
            const payload = { ...valid, specificDates: [{ slots: [slot] }] };

            expect(messages(payload)).toContain('"specificDates[0].date" is required');
        });

        it.each(["2026/11/02", "02-11-2026", "2026-1-2", "tomorrow", ""])(
            "should reject the malformed date %j",
            (date) => {
                expect(check({ ...valid, specificDates: [{ date, slots: [slot] }] }).error).toBeDefined();
            }
        );

        it("should require at least one slot per date", () => {
            const payload = { ...valid, specificDates: [{ date: "2026-11-02", slots: [] }] };

            expect(messages(payload)).toContain('"specificDates[0].slots" must contain at least 1 items');
        });

        it("should require the slots field itself", () => {
            const payload = { ...valid, specificDates: [{ date: "2026-11-02" }] };

            expect(messages(payload)).toContain('"specificDates[0].slots" is required');
        });
    });

    describe("slots", () => {
        const withSlot = (s) => ({ ...valid, specificDates: [{ date: "2026-11-02", slots: [s] }] });

        it("should require startTime and endTime", () => {
            expect(messages(withSlot({ endTime: "10:00" }))).toContain('"specificDates[0].slots[0].startTime" is required');
            expect(messages(withSlot({ startTime: "09:00" }))).toContain('"specificDates[0].slots[0].endTime" is required');
        });

        it.each(["9:00", "09:0", "0900", "09-00", "nine", ""])("should reject the malformed time %j", (time) => {
            expect(check(withSlot({ startTime: time, endTime: "10:00" })).error).toBeDefined();
            expect(check(withSlot({ startTime: "09:00", endTime: time })).error).toBeDefined();
        });

        it("should reject unknown fields inside a slot", () => {
            expect(check(withSlot({ ...slot, note: "x" })).error).toBeDefined();
        });
    });

    describe("googleCalendarConnected", () => {
        it("should be optional", () => {
            expect(check(valid).error).toBeUndefined();
        });

        it.each([true, false])("should accept %s", (googleCalendarConnected) => {
            expect(check({ ...valid, googleCalendarConnected }).error).toBeUndefined();
        });

        it("should reject a non-boolean value", () => {
            expect(check({ ...valid, googleCalendarConnected: "maybe" }).error).toBeDefined();
        });
    });

    it("should reject unknown top-level fields so callers cannot smuggle extra data", () => {
        const { error } = check({ ...valid, googleCalendarToken: "secret" });

        expect(error).toBeDefined();
        expect(error.details[0].message).toBe('"googleCalendarToken" is not allowed');
    });

    it("should report every problem at once when abortEarly is off", () => {
        expect(messages({})).toHaveLength(3);
    });
});