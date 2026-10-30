const mongoose = require("mongoose");
const { idToString } = require("../../utils/idToString");

describe("idToString", () => {
    const hex = "64b7f0c2a1b2c3d4e5f60718";

    test.each([[null], [undefined], [true], [Symbol("x")], [() => 1]])("%p -> undefined", (v) => {
        expect(idToString(v)).toBeUndefined();
    });

    test("strings pass through unchanged", () => {
        expect(idToString(hex)).toBe(hex);
        expect(idToString("")).toBe("");
    });

    test("numbers and bigints are stringified", () => {
        expect(idToString(42)).toBe("42");
        expect(idToString(0)).toBe("0");
        expect(idToString(10n)).toBe("10");
    });

    test("a Mongo ObjectId becomes its hex string", () => {
        expect(idToString(new mongoose.Types.ObjectId(hex))).toBe(hex);
    });

    test("a populated document resolves through its _id", () => {
        expect(idToString({ _id: hex, name: "Asha" })).toBe(hex);
        expect(idToString({ _id: new mongoose.Types.ObjectId(hex) })).toBe(hex);
        expect(idToString({ _id: { _id: hex } })).toBe(hex);
    });

    test("falls back to toHexString() and then a string id", () => {
        expect(idToString({ toHexString: () => "abc" })).toBe("abc");
        expect(idToString({ id: "xyz" })).toBe("xyz");
    });

    test("objects with no usable identifier -> undefined", () => {
        expect(idToString({})).toBeUndefined();
        expect(idToString({ id: 5 })).toBeUndefined();
        expect(idToString({ _id: null })).toBeUndefined();
    });

    test("a self-referencing _id does not recurse forever", () => {
        const self = { id: "fallback" };
        self._id = self;
        expect(idToString(self)).toBe("fallback");
    });
});
