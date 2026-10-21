const { escapeRegex } = require("../../../utils/escapeRegex");

describe("escapeRegex", () => {
    it("escapes regex metacharacters so a search term is treated literally", () => {
        const literal = "Ann.+(mentor)?[A-Z]\\";
        expect(escapeRegex(literal)).toBe("Ann\\.\\+\\(mentor\\)\\?\\[A-Z\\]\\\\");
        expect(new RegExp(escapeRegex(literal)).test(literal)).toBe(true);
    });
});
