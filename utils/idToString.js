/**
 * Converts an identifier to a stable string without default object coercion.
 * Supports strings, Mongo ObjectIds, and populated documents with an _id.
 * @param {unknown} value
 * @returns {string|undefined}
 */
const idToString = (value) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "bigint") return `${value}`;

    if (typeof value === "object") {
        const identifier = value._id;
        if (identifier !== undefined && identifier !== null && identifier !== value) {
            return idToString(identifier);
        }
        if (typeof value.toHexString === "function") return value.toHexString();
        if (typeof value.id === "string") return value.id;
        return undefined;
    }

    return undefined;
};

module.exports = { idToString };
