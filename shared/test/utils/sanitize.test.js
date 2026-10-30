const { sanitize, sanitizeHeaders, maskEmail, maskPhone } = require("../../utils/sanitize");
const mask = require("../../utils/mask");

describe("maskEmail", () => {
    test.each([
        ["nehal@yopmail.com", "ne***@yopmail.com"],
        ["a@x.io", "a***@x.io"],
        ["ab@x.io", "ab***@x.io"],
    ])("%s -> %s", (input, expected) => expect(maskEmail(input)).toBe(expected));

    test.each([[undefined], [null], [123], [{}], ["no-at-sign"], [""]])("%p -> [REDACTED]", (v) => {
        expect(maskEmail(v)).toBe("[REDACTED]");
    });
});

describe("maskPhone", () => {
    test("keeps the first 2 and last 3 characters", () => {
        expect(maskPhone("9876543210")).toBe("98******210");
    });

    test.each([["1234"], ["12"], [""]])("%p (4 chars or fewer) is fully redacted", (v) => {
        expect(maskPhone(v)).toBe("[REDACTED]");
    });

    test.each([[undefined], [null], [9876543210]])("non-string %p is fully redacted", (v) => {
        expect(maskPhone(v)).toBe("[REDACTED]");
    });
});

describe("sanitize", () => {
    test("redacts secret-looking keys", () => {
        expect(sanitize({
            password: "p", Password: "p", newPassword: "p", token: "t", accessToken: "t", refreshToken: "t",
            apiKey: "k", SECRET: "s", otp: "123456", cvv: "123", calendarTokenEncKey: "k",
        })).toEqual({
            password: "[REDACTED]", Password: "[REDACTED]", newPassword: "[REDACTED]", token: "[REDACTED]",
            accessToken: "[REDACTED]", refreshToken: "[REDACTED]", apiKey: "[REDACTED]", SECRET: "[REDACTED]",
            otp: "[REDACTED]", cvv: "[REDACTED]", calendarTokenEncKey: "[REDACTED]",
        });
    });

    // KNOWN BUG (see report): REDACTED_KEYS holds camelCase entries ("accessToken") but the
    // lower-cased lookup key is compared against them, so only all-lowercase entries match
    // case-insensitively. Remove `.failing` once the sets are lower-cased in sanitize.js.
    test.failing("redacts camelCase secret keys regardless of the casing used by the client", () => {
        expect(sanitize({ AccessToken: "t", REFRESHTOKEN: "r", Apikey: "k" })).toEqual({
            AccessToken: "[REDACTED]", REFRESHTOKEN: "[REDACTED]", Apikey: "[REDACTED]",
        });
    });

    test("partially masks email and phone-like keys", () => {
        expect(sanitize({ email: "nehal@yopmail.com", phone: "9876543210", Mobile: "9876543210", phoneNumber: "12" }))
            .toEqual({ email: "ne***@yopmail.com", phone: "98******210", Mobile: "98******210", phoneNumber: "[REDACTED]" });
    });

    test("leaves other values untouched", () => {
        const input = { name: "Asha", count: 3, ok: true, nothing: null, missing: undefined };
        expect(sanitize(input)).toEqual(input);
    });

    test("recurses into nested objects and arrays", () => {
        const out = sanitize({ user: { email: "a@b.com", profile: { password: "x" } }, list: [{ token: "t" }, "plain"] });
        expect(out).toEqual({
            user: { email: "a***@b.com", profile: { password: "[REDACTED]" } },
            list: [{ token: "[REDACTED]" }, "plain"],
        });
    });

    test("does not mutate its input", () => {
        const input = { password: "secret", nested: { email: "a@b.com" } };
        sanitize(input);
        expect(input).toEqual({ password: "secret", nested: { email: "a@b.com" } });
    });

    test.each([[null], [undefined], ["str"], [42], [true]])("passes primitive %p through", (v) => {
        expect(sanitize(v)).toBe(v);
    });

    test("stops at depth 10 instead of recursing forever", () => {
        let deep = { leaf: "x" };
        for (let i = 0; i < 15; i += 1) deep = { child: deep };
        let node = sanitize(deep);
        let depth = 0;
        while (node && typeof node === "object" && node.child) { node = node.child; depth += 1; }
        expect(node).toBe("[DEPTH_LIMIT]");
        expect(depth).toBeLessThan(15);
    });
});

describe("sanitizeHeaders", () => {
    test("masks the scheme-preserving Authorization header and redacts other credential headers", () => {
        expect(sanitizeHeaders({
            Authorization: "Bearer abc.def.ghi",
            Cookie: "accessToken=abc",
            "X-API-Key": "k",
            "x-refresh-token": "r",
            "Content-Type": "application/json",
        })).toEqual({
            Authorization: "Bearer [REDACTED]",
            Cookie: "[REDACTED]",
            "X-API-Key": "[REDACTED]",
            "x-refresh-token": "[REDACTED]",
            "Content-Type": "application/json",
        });
    });

    test("an Authorization value without a scheme is fully redacted", () => {
        expect(sanitizeHeaders({ authorization: "rawtoken" })).toEqual({ authorization: "[REDACTED]" });
    });

    test.each([[null], [undefined], ["str"], [5]])("returns {} for %p", (v) => {
        expect(sanitizeHeaders(v)).toEqual({});
    });
});

describe("utils/mask re-exports", () => {
    test("exposes the same functions as sanitize", () => {
        expect(mask.maskEmail).toBe(maskEmail);
        expect(mask.maskPhone).toBe(maskPhone);
        expect(mask.sanitize).toBe(sanitize);
        expect(mask.sanitizeHeaders).toBe(sanitizeHeaders);
    });
});
