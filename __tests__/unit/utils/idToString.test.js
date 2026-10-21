const mongoose = require("mongoose");
const { idToString } = require("../../../utils/idToString");

describe("idToString", () => {
    it("preserves string identifiers", () => {
        expect(idToString("user-1")).toBe("user-1");
    });

    it("converts Mongo ObjectIds to their hexadecimal representation", () => {
        const objectId = new mongoose.Types.ObjectId();
        expect(idToString(objectId)).toBe(objectId.toHexString());
    });

    it("extracts identifiers from populated documents", () => {
        const objectId = new mongoose.Types.ObjectId();
        expect(idToString({ _id: objectId, name: "Mentor" })).toBe(objectId.toHexString());
    });

    it("returns undefined for missing or unsupported identifier values", () => {
        expect(idToString(undefined)).toBeUndefined();
        expect(idToString(null)).toBeUndefined();
        expect(idToString({ name: "not an identifier" })).toBeUndefined();
    });
});
