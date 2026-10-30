/**
 * @fileoverview Unit tests for the mentor profile Joi schema.
 */

const { profileSchema } = require("../../../src/validators/mentorProfile.validator");

const check = (payload) => profileSchema.validate(payload, { abortEarly: false });
const messages = (payload) => (check(payload).error?.details ?? []).map((d) => d.message);

const valid = {
    currentRole: "Staff Engineer",
    industry: "Software",
    company: "Nineleaps",
    bio: "Ten years building distributed systems.",
    yearsOfExperience: 10,
    hourlyRate: 80,
    skills: ["node", "mongodb"],
    communicationPreferences: ["Chat", "Video Call"],
    languages: ["English"],
    linkedInUrl: "https://linkedin.com/in/someone",
    portfolioUrl: "https://example.com",
    profilePicture: "https://res.cloudinary.com/demo/image/upload/a.jpg",
    phoneNumber: "+91 98765 43210",
};

describe("mentor profileSchema", () => {
    it("should accept a complete, valid payload unchanged", () => {
        const { error, value } = check(valid);

        expect(error).toBeUndefined();
        expect(value).toEqual(valid);
    });

    it("should accept an empty object because every field is optional (partial updates)", () => {
        expect(check({}).error).toBeUndefined();
    });

    describe("text fields", () => {
        it.each([
            ["currentRole", 100],
            ["industry", 100],
            ["company", 100],
        ])("should accept %s at exactly %i characters and reject one more", (field, max) => {
            expect(check({ [field]: "x".repeat(max) }).error).toBeUndefined();
            expect(messages({ [field]: "x".repeat(max + 1) })).toContain(
                `"${field}" length must be less than or equal to ${max} characters long`
            );
        });

        it.each(["currentRole", "industry", "company"])("should allow %s to be cleared with an empty string", (field) => {
            expect(check({ [field]: "" }).error).toBeUndefined();
        });

        it("should trim surrounding whitespace", () => {
            expect(check({ currentRole: "  Lead  " }).value.currentRole).toBe("Lead");
        });
    });

    describe("bio", () => {
        it("should allow an empty bio so it can be cleared", () => {
            expect(check({ bio: "" }).error).toBeUndefined();
        });

        it("should reject a bio shorter than 10 characters with the custom message", () => {
            expect(messages({ bio: "too short" })).toEqual(["Bio must be at least 10 characters"]);
        });

        it("should accept a bio of exactly 10 characters", () => {
            expect(check({ bio: "x".repeat(10) }).error).toBeUndefined();
        });

        it("should accept a bio of exactly 1000 characters and reject one more", () => {
            expect(check({ bio: "x".repeat(1000) }).error).toBeUndefined();
            expect(messages({ bio: "x".repeat(1001) })).toContain('"bio" length must be less than or equal to 1000 characters long');
        });

        it("should measure the minimum length after trimming", () => {
            expect(messages({ bio: "   short   " })).toContain("Bio must be at least 10 characters");
        });
    });

    describe("yearsOfExperience", () => {
        it.each([0, 1, 60])("should accept %s", (yearsOfExperience) => {
            expect(check({ yearsOfExperience }).error).toBeUndefined();
        });

        it("should reject negative values and anything above 60", () => {
            expect(messages({ yearsOfExperience: -1 })).toContain('"yearsOfExperience" must be greater than or equal to 0');
            expect(messages({ yearsOfExperience: 61 })).toContain('"yearsOfExperience" must be less than or equal to 60');
        });

        it("should convert a numeric string to a number", () => {
            expect(check({ yearsOfExperience: "7" }).value.yearsOfExperience).toBe(7);
        });

        it("should reject a non-numeric value", () => {
            expect(check({ yearsOfExperience: "lots" }).error).toBeDefined();
        });
    });

    describe("hourlyRate", () => {
        it.each([0, 49.5, 10000])("should accept %s", (hourlyRate) => {
            expect(check({ hourlyRate }).error).toBeUndefined();
        });

        it("should reject a negative rate", () => {
            expect(messages({ hourlyRate: -1 })).toContain('"hourlyRate" must be greater than or equal to 0');
        });

        it("should reject a non-numeric rate", () => {
            expect(check({ hourlyRate: "free" }).error).toBeDefined();
        });
    });

    describe("phoneNumber", () => {
        it("should accept up to 20 characters and reject one more", () => {
            expect(check({ phoneNumber: "1".repeat(20) }).error).toBeUndefined();
            expect(check({ phoneNumber: "1".repeat(21) }).error).toBeDefined();
        });

        it("should allow an empty string", () => {
            expect(check({ phoneNumber: "" }).error).toBeUndefined();
        });
    });

    describe("list fields", () => {
        it.each(["skills", "languages"])("should accept an array of strings for %s", (field) => {
            expect(check({ [field]: ["a", "b"] }).error).toBeUndefined();
        });

        it.each(["skills", "languages"])("should reject non-string items in %s", (field) => {
            expect(check({ [field]: [1] }).error).toBeDefined();
        });
    });

    describe("communicationPreferences", () => {
        it.each(["Chat", "Email", "Video Call", "Phone Call", "In-Person"])("should accept %s", (pref) => {
            expect(check({ communicationPreferences: [pref] }).error).toBeUndefined();
        });

        it("should reject a value outside the allowed list", () => {
            expect(check({ communicationPreferences: ["Telepathy"] }).error).toBeDefined();
        });
    });

    describe("urls", () => {
        it.each(["linkedInUrl", "portfolioUrl"])("should accept a valid %s and allow it to be cleared", (field) => {
            expect(check({ [field]: "https://example.com/me" }).error).toBeUndefined();
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
    });

    describe("unknown fields", () => {
        it.each(["avgRating", "ratingCount", "verificationStatus", "totalSessions", "isProfilePublished", "user"])(
            "should reject %s because a mentor cannot set it directly",
            (field) => {
                const { error } = check({ [field]: 5 });

                expect(error).toBeDefined();
                expect(error.details[0].message).toBe(`"${field}" is not allowed`);
            }
        );

        it("should reject interestedFields, which belongs to the mentee schema", () => {
            expect(check({ interestedFields: ["x"] }).error).toBeDefined();
        });
    });

    it("should report every problem at once when abortEarly is off", () => {
        expect(messages({ hourlyRate: -1, yearsOfExperience: 99, bio: "short" })).toHaveLength(3);
    });
});
