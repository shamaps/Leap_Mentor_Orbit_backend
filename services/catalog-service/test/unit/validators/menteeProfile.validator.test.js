/**
 * @fileoverview Unit tests for the mentee profile Joi schema.
 */

const { profileSchema } = require("../../../src/validators/menteeProfile.validator");

const check = (payload) => profileSchema.validate(payload, { abortEarly: false });
const messages = (payload) => (check(payload).error?.details ?? []).map((d) => d.message);

const valid = {
    currentRole: "Junior Developer",
    industry: "Software",
    company: "Nineleaps",
    bio: "Learning full-stack development.",
    yearsOfExperience: "2",
    skills: ["node", "react"],
    interestedFields: ["backend"],
    communicationPreferences: ["Chat", "Video Call"],
    languages: ["English", "Tamil"],
    linkedInUrl: "https://linkedin.com/in/someone",
    portfolioUrl: "https://example.com",
    profilePicture: "https://res.cloudinary.com/demo/image/upload/a.jpg",
};

describe("mentee profileSchema", () => {
    it("should accept a complete, valid payload unchanged", () => {
        const { error, value } = check(valid);

        expect(error).toBeUndefined();
        expect(value).toEqual(valid);
    });

    it("should accept an empty object because every field is optional (partial updates)", () => {
        expect(check({}).error).toBeUndefined();
    });

    it("should accept a single-field update", () => {
        expect(check({ company: "Acme" }).error).toBeUndefined();
    });

    describe("text fields", () => {
        it.each([
            ["currentRole", 100],
            ["industry", 100],
            ["company", 100],
            ["bio", 1000],
        ])("should accept %s at exactly %i characters and reject one more", (field, max) => {
            expect(check({ [field]: "x".repeat(max) }).error).toBeUndefined();
            expect(messages({ [field]: "x".repeat(max + 1) })).toContain(
                `"${field}" length must be less than or equal to ${max} characters long`
            );
        });

        it.each(["currentRole", "industry", "company", "bio"])("should allow %s to be cleared with an empty string", (field) => {
            expect(check({ [field]: "" }).error).toBeUndefined();
        });

        it("should trim surrounding whitespace", () => {
            const { value } = check({ currentRole: "  Developer  ", bio: "\t hello there \n" });

            expect(value.currentRole).toBe("Developer");
            expect(value.bio).toBe("hello there");
        });

        it("should not enforce a minimum bio length (unlike the mentor schema)", () => {
            expect(check({ bio: "short" }).error).toBeUndefined();
        });
    });

    describe("yearsOfExperience", () => {
        it("should accept a string value, matching the mentee model's String type", () => {
            expect(check({ yearsOfExperience: "5" }).error).toBeUndefined();
        });
    });

    describe("list fields", () => {
        it.each(["skills", "interestedFields", "languages"])("should accept an array of strings for %s", (field) => {
            expect(check({ [field]: ["a", "b"] }).error).toBeUndefined();
        });

        it.each(["skills", "interestedFields", "languages"])("should accept an empty array for %s", (field) => {
            expect(check({ [field]: [] }).error).toBeUndefined();
        });

        it.each(["skills", "interestedFields", "languages"])("should reject non-string items in %s", (field) => {
            expect(check({ [field]: [1, 2] }).error).toBeDefined();
        });

        it.each(["skills", "interestedFields", "languages"])("should reject a plain string for %s", (field) => {
            expect(check({ [field]: "node" }).error).toBeDefined();
        });
    });

    describe("communicationPreferences", () => {
        it.each(["Chat", "Email", "Video Call", "Phone Call", "In-Person"])("should accept %s", (pref) => {
            expect(check({ communicationPreferences: [pref] }).error).toBeUndefined();
        });

        it("should reject a value outside the allowed list", () => {
            expect(check({ communicationPreferences: ["Carrier Pigeon"] }).error).toBeDefined();
        });

        it("should be case-sensitive", () => {
            expect(check({ communicationPreferences: ["chat"] }).error).toBeDefined();
        });
    });

    describe("urls", () => {
        it.each(["linkedInUrl", "portfolioUrl"])("should accept a valid %s", (field) => {
            expect(check({ [field]: "https://example.com/me" }).error).toBeUndefined();
        });

        it.each(["linkedInUrl", "portfolioUrl"])("should allow %s to be cleared with an empty string", (field) => {
            expect(check({ [field]: "" }).error).toBeUndefined();
        });

        it.each(["linkedInUrl", "portfolioUrl"])("should reject an invalid %s", (field) => {
            expect(messages({ [field]: "not a url" })).toContain(`"${field}" must be a valid uri`);
        });
    });

    describe("profilePicture", () => {
        it("should accept up to 2048 characters and reject one more", () => {
            expect(check({ profilePicture: "x".repeat(2048) }).error).toBeUndefined();
            expect(check({ profilePicture: "x".repeat(2049) }).error).toBeDefined();
        });

        it("should allow an empty string", () => {
            expect(check({ profilePicture: "" }).error).toBeUndefined();
        });
    });

    describe("unknown fields", () => {
        it.each(["hourlyRate", "phoneNumber", "isDeleted", "user", "verificationStatus"])(
            "should reject %s because a mentee cannot set it",
            (field) => {
                const { error } = check({ [field]: "x" });

                expect(error).toBeDefined();
                expect(error.details[0].message).toBe(`"${field}" is not allowed`);
            }
        );
    });

    it("should report every problem at once when abortEarly is off", () => {
        expect(messages({ currentRole: "x".repeat(101), linkedInUrl: "nope", skills: "node" })).toHaveLength(3);
    });
});
