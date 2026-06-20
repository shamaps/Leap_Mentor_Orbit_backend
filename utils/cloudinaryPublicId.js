// utils/cloudinaryPublicId.js

/**
 * Sanitises a string for use in a Cloudinary public_id.
 * Removes special characters, replaces spaces with hyphens, lowercases.
 */
const sanitise = (str) =>
    str
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "-")   // replace anything not safe with hyphen
        .replace(/-+/g, "-")              // collapse multiple hyphens
        .replace(/^-|-$/g, "")           // strip leading/trailing hyphens
        .slice(0, 80);                    // max 80 chars for the filename portion

/**
 * Strips file extension from a filename string.
 */
const stripExt = (filename) => filename.replace(/\.[^/.]+$/, "");

/**
 * Profile picture: leapmentor/profiles/user-{userId}
 * One slot per user — overwriting is intentional (latest picture wins).
 */
const profilePictureId = (userId) =>
    `leapmentor/profiles/user-${userId}`;

/**
 * Resume: leapmentor/verification-docs/resumes/{userId}/{sanitised-filename}_{timestamp}
 */
const resumeId = (userId, originalname) =>
    `leapmentor/verification-docs/resumes/${userId}/${sanitise(stripExt(originalname))}_${Date.now()}`;

/**
 * Work experience doc: leapmentor/verification-docs/work-experience/{userId}/{sanitised-filename}_{timestamp}
 */
const workExperienceId = (userId, originalname) =>
    `leapmentor/verification-docs/work-experience/${userId}/${sanitise(stripExt(originalname))}_${Date.now()}`;

/**
 * Session note: leapmentor/notes/{connectRequestId}/{userId}_{sanitised-filename}_{timestamp}
 * userId in filename = you know who uploaded it without querying DB.
 */
const noteId = (connectRequestId, userId, originalname) =>
    `leapmentor/notes/${connectRequestId}/${userId}_${sanitise(stripExt(originalname))}_${Date.now()}`;

/**
 * Report screenshot: leapmentor/reports/{connectRequestId}/{userId}_screenshot_{timestamp}
 */
const reportScreenshotId = (connectRequestId, userId) =>
    `leapmentor/reports/${connectRequestId}/${userId}_screenshot_${Date.now()}`;

module.exports = {
    profilePictureId,
    resumeId,
    workExperienceId,
    noteId,
    reportScreenshotId,
};