const toMenteeProfileDTO = (doc) => {
    if (!doc) return null;
    return {
        id: doc._id,
        _id: doc._id,
        userId: doc.user,
        profilePicture: doc.profilePicture || "",
        currentRole: doc.currentRole || "",
        company: doc.company || "",
        bio: doc.bio || "",
        skills: doc.skills || [],
        interestedFields: doc.interestedFields || [],
        isProfileComplete: doc.isProfileComplete,
    };
};

const toMenteeProfileSummary = (doc) => {
    if (!doc) return null;
    return {
        id: doc._id,
        _id: doc._id,
        profilePicture: doc.profilePicture || "",
        currentRole: doc.currentRole || "",
        company: doc.company || "",
        skills: doc.skills || [],
    };
};

module.exports = { toMenteeProfileDTO, toMenteeProfileSummary };