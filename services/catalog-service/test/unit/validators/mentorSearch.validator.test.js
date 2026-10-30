/**
 * @fileoverview Unit tests for the public mentor-search query Joi schema.
 */

const { searchQuerySchema } = require("../../../src/validators/mentorSearch.validator");

const check = (payload) => searchQuerySchema.validate(payload, { abortEarly: false });
const messages = (payload) => (check(payload).error?.details ?? []).map((d) => d.message);

describe("searchQuerySchema", () => {
    it("should accept an empty query so the endpoint can list everything", () => {
        const { error, value } = check({});

        expect(error).toBeUndefined();
        expect(value).toEqual({});
    });

    it("should accept a complete query", () => {
        const query = { q: "react", industry: "Software", skills: "node,react", page: 2, limit: 20 };

        const { error, value } = check(query);

        expect(error).toBeUndefined();
        expect(value).toEqual(query);
    });

    it("should accept empty strings for the text filters, as sent by a cleared search box", () => {
        expect(check({ q: "", industry: "", skills: "" }).error).toBeUndefined();
    });

    describe("text filters", () => {
        it.each([
            ["q", 100],
            ["industry", 100],
            ["skills", 200],
        ])("should accept %s at exactly %i characters and reject one more", (field, max) => {
            expect(check({ [field]: "x".repeat(max) }).error).toBeUndefined();
            expect(messages({ [field]: "x".repeat(max + 1) })).toContain(
                `"${field}" length must be less than or equal to ${max} characters long`
            );
        });

        it("should reject non-string values", () => {
            expect(check({ q: 123 }).error).toBeDefined();
        });
    });

    describe("page", () => {
        it("should convert a numeric string, because query parameters arrive as text", () => {
            const { error, value } = check({ page: "3" });

            expect(error).toBeUndefined();
            expect(value.page).toBe(3);
        });

        it("should accept the first page", () => {
            expect(check({ page: 1 }).error).toBeUndefined();
        });

        it.each([0, -1])("should reject %s as below the minimum", (page) => {
            expect(messages({ page })).toContain('"page" must be greater than or equal to 1');
        });

        it("should reject fractional and non-numeric pages", () => {
            expect(messages({ page: 1.5 })).toContain('"page" must be an integer');
            expect(check({ page: "abc" }).error).toBeDefined();
        });
    });

    describe("limit", () => {
        it("should convert a numeric string", () => {
            expect(check({ limit: "10" }).value.limit).toBe(10);
        });

        it.each([1, 50])("should accept the boundary value %i", (limit) => {
            expect(check({ limit }).error).toBeUndefined();
        });

        it("should reject zero and negatives", () => {
            expect(messages({ limit: 0 })).toContain('"limit" must be greater than or equal to 1');
            expect(check({ limit: -5 }).error).toBeDefined();
        });

        it("should reject more than 50 results per page", () => {
            expect(messages({ limit: 51 })).toContain('"limit" must be less than or equal to 50');
        });

        it("should reject fractional limits", () => {
            expect(messages({ limit: 2.5 })).toContain('"limit" must be an integer');
        });
    });

    it("should reject unknown query parameters", () => {
        const { error } = check({ sort: "rating" });

        expect(error).toBeDefined();
        expect(error.details[0].message).toBe('"sort" is not allowed');
    });

    it("should report every problem at once when abortEarly is off", () => {
        expect(messages({ page: 0, limit: 99, q: "x".repeat(101) })).toHaveLength(3);
    });
});
