// config/constants.js

const ACTIVE_SESSION_STATUSES = ["ongoing", "completed"];
const VALID_REQUEST_STATUSES = ["pending", "accepted", "rejected", "referred"];
const VALID_RESPOND_STATUSES = ["accepted", "rejected"];
const VALID_GOAL_STATUSES = ["active", "completed", "abandoned"];

// Wallet / LP constants
const WELCOME_BONUS_LP = 500;  // LP credited to new mentees on signup
const LEAP_REFILL_THRESHOLD = 500;  // max balance to qualify for a leap refill
const LEAP_REFILL_AMOUNT = 500;  // LP added when admin approves a leap request

// Platform defaults
const DEFAULT_COMMISSION_RATE = 5;  // % platform fee, fallback if not set in AdminUser
const PLATFORM_TIMEZONE = process.env.PLATFORM_TIMEZONE || "Asia/Kolkata";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
module.exports = {
    ACTIVE_SESSION_STATUSES,
    VALID_REQUEST_STATUSES,
    VALID_RESPOND_STATUSES,
    VALID_GOAL_STATUSES,
    WELCOME_BONUS_LP,
    LEAP_REFILL_THRESHOLD,
    LEAP_REFILL_AMOUNT,
    DEFAULT_COMMISSION_RATE,
    PLATFORM_TIMEZONE,
    IST_OFFSET_MS,
};