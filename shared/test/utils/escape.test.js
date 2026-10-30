const { escapeHtml } = require("../../utils/escapeHtml");
const { escapeRegex } = require("../../utils/escapeRegex");

describe("escapeHtml", () => {
    test("escapes the five HTML-significant characters", () => {
        expect(escapeHtml(`<a href="x" onclick='y'>&</a>`))
            .toBe("&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
    });

    test("escapes & first, so existing entities are not double-decoded", () => {
        expect(escapeHtml("&lt;")).toBe("&amp;lt;");
    });

    test("neutralises a script-injection attempt", () => {
        const out = escapeHtml('<script>alert("xss")</script>');
        expect(out).not.toMatch(/<script>/);
        expect(out).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    });

    test.each([[null], [undefined]])("%p -> empty string", (v) => expect(escapeHtml(v)).toBe(""));

    test("coerces non-strings", () => {
        expect(escapeHtml(42)).toBe("42");
        expect(escapeHtml(false)).toBe("false");
    });

    test("leaves safe text alone", () => {
        expect(escapeHtml("Hello, Asha! 😀")).toBe("Hello, Asha! 😀");
    });
});

describe("escapeRegex", () => {
    test("escapes every regex metacharacter", () => {
        expect(escapeRegex(".*+?^${}()|[]\\")).toBe("\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\");
    });

    test("the escaped string matches the original literally", () => {
        const input = "a.b*c (d)";
        expect(new RegExp(`^${escapeRegex(input)}$`).test(input)).toBe(true);
        expect(new RegExp(`^${escapeRegex(input)}$`).test("aXb*c (d)")).toBe(false);
    });

    test("leaves plain text alone", () => {
        expect(escapeRegex("plain text 123")).toBe("plain text 123");
    });

    test("prevents a user-supplied pattern from acting as a wildcard", () => {
        expect(new RegExp(escapeRegex(".*")).test("anything")).toBe(false);
    });
});
