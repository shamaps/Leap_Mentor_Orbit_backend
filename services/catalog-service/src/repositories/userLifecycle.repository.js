const MentorProfile = require("@leapmentor/shared/models/MentorProfile");
const MenteeProfile = require("@leapmentor/shared/models/MenteeProfile");

// deleteMany/updateMany skip the soft-delete find hook, so already
// soft-deleted profiles are still reachable.
const deleteProfiles = async (userId) => {
    const [mentor, mentee] = await Promise.all([
        MentorProfile.deleteMany({ user: userId }),
        MenteeProfile.deleteMany({ user: userId }),
    ]);
    return { mentorProfiles: mentor.deletedCount ?? 0, menteeProfiles: mentee.deletedCount ?? 0 };
};

const softDeleteProfiles = async (userId, now = new Date()) => {
    const patch = { $set: { isDeleted: true, deletedAt: now } };
    const filter = { user: userId, isDeleted: { $ne: true } };
    const [mentor, mentee] = await Promise.all([
        MentorProfile.updateMany(filter, patch),
        MenteeProfile.updateMany(filter, patch),
    ]);
    return { mentorProfiles: mentor.modifiedCount ?? 0, menteeProfiles: mentee.modifiedCount ?? 0 };
};

const restoreProfiles = async (userId) => {
    const patch = { $set: { isDeleted: false, deletedAt: null } };
    const filter = { user: userId, isDeleted: true };
    const [mentor, mentee] = await Promise.all([
        MentorProfile.updateMany(filter, patch),
        MenteeProfile.updateMany(filter, patch),
    ]);
    return { mentorProfiles: mentor.modifiedCount ?? 0, menteeProfiles: mentee.modifiedCount ?? 0 };
};

module.exports = { deleteProfiles, softDeleteProfiles, restoreProfiles };