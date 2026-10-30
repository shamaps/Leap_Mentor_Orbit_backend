const MentorProfile = require("@leapmentor/shared/models/MentorProfile");
const Availability = require("@leapmentor/shared/models/Availability");
const CompletedSession = require("@leapmentor/shared/models/CompletedSession");
const { withTransaction } = require("@leapmentor/shared/utils/withTransaction");

const updateMentorRating = async (mentorId, avgRating, ratingCount) => {
    const profile = await MentorProfile.findOneAndUpdate(
        { user: mentorId, $or: [{ ratingCount: { $lte: ratingCount } }, { ratingCount: { $exists: false } }] },
        { $set: { avgRating, ratingCount } },
        { returnDocument: "after", runValidators: true }
    ).select("user avgRating ratingCount");
    if (profile) return profile;
    return MentorProfile.findOne({ user: mentorId }).select("user avgRating ratingCount");
};
const recordCompletedSession = (requestId, mentorId) =>
    withTransaction(async (session) => {
        const existing = await CompletedSession.exists({ requestId }).session(session);

        if (existing) {
            return { counted: false, reason: "already_counted" };
        }

        const profile = await MentorProfile.findOneAndUpdate(
            { user: mentorId },
            { $inc: { totalSessions: 1 } },
            { session }
        );

        if (!profile) {
            return { counted: false, reason: "mentor_profile_not_found" };
        }

        await CompletedSession.create(
            [{ requestId, mentor: mentorId }],
            { session }
        );

        return { counted: true };
    }, "catalog.recordCompletedSession");

const findMentorAvailability = (mentorId) =>
    Availability.findOne({ mentor: mentorId }).select("timezone sessionDurations specificDates").lean();

module.exports = { updateMentorRating, findMentorAvailability, recordCompletedSession };