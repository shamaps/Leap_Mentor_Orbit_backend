/**
 * @fileoverview Shared test-data factories for integration tests.
 *
 * These factories create documents using the REAL production Mongoose
 * models (models/*.js), not hand-rolled mini-schemas. This guarantees
 * that integration tests are exercised against the same validation
 * rules, required fields, and enums that run in production — so a
 * test can never pass against a fake shape that the real schema
 * would reject.
 */

const mongoose = require("mongoose");

// Import the REAL models so schema validation is identical to production.
const User = require("../../models/User");
const AdminUser = require("../../models/AdminUser");
const ConnectRequest = require("../../models/ConnectRequest");
const MentorProfile = require("../../models/MentorProfile");
const MenteeProfile = require("../../models/MenteeProfile");

// NEW PRODUCTION MODEL IMPORTS
const SlotLock = require("../../models/SlotLock");
const Report = require("../../models/Report");
const SupportMessage = require("../../models/SupportMessage");

let userCounter = 0;
let adminCounter = 0;

/**
 * Returns a guaranteed-unique email for a given prefix, so parallel
 * tests/documents never collide on the unique email index.
 */
const uniqueEmail = (prefix = "user") => {
    userCounter += 1;
    return `${prefix}+${Date.now()}_${userCounter}@test.leapmentor.dev`;
};

/**
 * Creates a valid User document.
 * Defaults to a single "mentee" role (the real schema requires exactly one role).
 */
const makeUser = (overrides = {}) =>
    User.create({
        name: "Test User",
        email: uniqueEmail("user"),
        roles: ["mentee"],
        termsAccepted: true,
        ...overrides,
    });

/**
 * Creates a valid mentor User in one call (roles: ["mentor"]).
 */
const makeMentorUser = (overrides = {}) =>
    makeUser({ name: "Test Mentor", roles: ["mentor"], ...overrides });

/**
 * Creates a valid mentee User in one call (roles: ["mentee"]).
 */
const makeMenteeUser = (overrides = {}) =>
    makeUser({ name: "Test Mentee", roles: ["mentee"], ...overrides });

/**
 * Creates a valid AdminUser document.
 */
const makeAdminUser = (overrides = {}) => {
    adminCounter += 1;
    return AdminUser.create({
        name: "Test Admin",
        email: `admin+${Date.now()}_${adminCounter}@test.leapmentor.dev`,
        password: "hashed_password_placeholder",
        ...overrides,
    });
};

/**
 * Creates a valid selected-slot sub-object, matching selectedSlotSchema's
 * required fields, for embedding into a ConnectRequest's selectedSlots array.
 */
const makeSelectedSlot = (overrides = {}) => ({
    day: "Monday",
    date: "2026-06-29",
    startTime: "09:00",
    endTime: "10:00",
    ...overrides,
});

/**
 * Creates a valid ConnectRequest (session) document.
 */
const makeConnectRequest = (overrides = {}) =>
    ConnectRequest.create({
        status: "pending",
        paymentStatus: "unpaid",
        selectedSlots: [makeSelectedSlot()],
        ...overrides,
    });

/**
 * Creates a valid MentorProfile document. Requires `user` (ObjectId) override.
 */
const makeMentorProfile = (overrides = {}) =>
    MentorProfile.create({
        ...overrides,
    });

/**
 * Creates a valid MenteeProfile document. Requires `user` (ObjectId) override.
 */
const makeMenteeProfile = (overrides = {}) =>
    MenteeProfile.create({
        ...overrides,
    });

/* ==========================================================================
   🔹 NEWLY ADDED FACTORIES FOR REPOSITORY INTEGRATION ALIGNMENT
   ========================================================================== */

/**
 * Creates a valid SlotLock document.
 * Enforces production validation schemas for dates and time offsets.
 * Requires `mentorId` and `lockedBy` (Mongoose ObjectIds) inside overrides.
 */
const makeSlotLock = (overrides = {}) =>
    SlotLock.create({
        date: "2026-07-06",
        startTime: "09:00",
        endTime: "10:00",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        ...overrides,
    });

/**
 * Creates a valid moderation Report document.
 * Satisfies production validation constraints (e.g., description length floor >= 10 chars).
 * Requires `connectRequest`, `reportedBy`, and `reportedUser` ObjectIds inside overrides.
 */
const makeReport = (overrides = {}) =>
    Report.create({
        reporterRole: "mentee",
        complaintType: "no_show",
        description: "The user did not log into the active session block.",
        status: "pending",
        ...overrides,
    });

/**
 * Creates a valid SupportMessage document.
 * Satisfies strict input validation rules (subject min 3, message min 10).
 */
const makeSupportMessage = (overrides = {}) =>
    SupportMessage.create({
        email: uniqueEmail("support"),
        subject: "Booking session failure",
        message: "The checkout portal drops requests when processing voucher adjustments.",
        role: "user",
        status: "open",
        ...overrides,
    });

module.exports = {
    mongoose,
    makeUser,
    makeMentorUser,
    makeMenteeUser,
    makeAdminUser,
    makeConnectRequest,
    makeSelectedSlot,
    makeMentorProfile,
    makeMenteeProfile,
    // Export new real model factory bindings
    makeSlotLock,
    makeReport,
    makeSupportMessage,
};