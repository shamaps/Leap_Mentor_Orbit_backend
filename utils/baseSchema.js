// utils/baseSchema.js
const mongoose = require("mongoose");

/**
 * Base schema options applied to every model.
 * Centralises timestamps and toJSON transform so
 * no model needs to repeat these individually.
 */
const BASE_SCHEMA_OPTIONS = {
    timestamps: true,
    versionKey: false,
    toJSON: {
        virtuals: true,
        transform: (_doc, ret) => {
            delete ret.__v;
            return ret;
        },
    },
};

/**
 * Mixin for soft-delete fields.
 * Apply to any schema that needs soft-delete support.
 */
const SOFT_DELETE_FIELDS = {
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
};

/**
 * Attaches the standard soft-delete pre-find middleware to a schema.
 * @param {mongoose.Schema} schema
 */
function applySoftDelete(schema) {
    schema.add(SOFT_DELETE_FIELDS);

    schema.pre(/^find/, function (next) {
        if (typeof next !== "function") return;
        const options = this.getOptions() || {};
        const filter = this.getFilter() || {};
        if (options.ignoreIsDeleted) return next();
        if (filter.isDeleted === true) return next();
        this.where({ isDeleted: { $ne: true } });
        next();
    });
}

module.exports = { BASE_SCHEMA_OPTIONS, applySoftDelete };