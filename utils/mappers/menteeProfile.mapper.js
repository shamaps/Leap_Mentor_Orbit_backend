const toMenteeProfileDTO = (doc) => {
    if (!doc) return null;
    return {
        id: doc._id,
        _id: doc._id,
        userId: doc.user,
        profilePicture: doc.profilePicture || "",
        currentRole: doc.currentRole || "",
        company: doc.company || "",
        industry: doc.industry || "",
        yearsOfExperience: doc.yearsOfExperience || "",
        bio: doc.bio || "",
        skills: doc.skills || [],
        interestedFields: doc.interestedFields || [],
        communicationPreferences: doc.communicationPreferences || [],
        languages: doc.languages || [],
        linkedInUrl: doc.linkedInUrl || "",
        portfolioUrl: doc.portfolioUrl || "",
        isProfileComplete: doc.isProfileComplete,
        isProfilePublished: doc.isProfilePublished,
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