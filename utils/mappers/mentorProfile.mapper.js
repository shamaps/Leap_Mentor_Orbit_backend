// Frontend reads: profilePicture, currentRole, company, industry,
//                 avgRating, hourlyRate, skills, bio, yearsOfExperience,
//                 isProfileComplete, isProfilePublished, verificationStatus

const toMentorProfileDTO = (doc) => {
    if (!doc) return null;
    return {
        id: doc._id,
        _id: doc._id,
        userId: doc.user,
        profilePicture: doc.profilePicture || "",
        currentRole: doc.currentRole || "",
        company: doc.company || "",
        industry: doc.industry || "",
        bio: doc.bio || "",
        skills: doc.skills || [],
        languages: doc.languages || [],
        yearsOfExperience: doc.yearsOfExperience || 0,
        hourlyRate: doc.hourlyRate || 0,
        avgRating: doc.avgRating || 0,
        totalSessions: doc.totalSessions || 0,
        communicationPreferences: doc.communicationPreferences || [],
        isProfileComplete: doc.isProfileComplete,
        isProfilePublished: doc.isProfilePublished,
        verificationStatus: doc.verificationStatus,
        linkedInUrl: doc.linkedInUrl || "",
        portfolioUrl: doc.portfolioUrl || "",
    };
    // Stripped: resumeDocument, workExperienceDocuments (internal verification docs),
    ///         phoneNumber, emailNotifications, __v, isDeleted
};

const toMentorProfileSummary = (doc) => {
    if (!doc) return null;
    return {
        id: doc._id,
        _id: doc._id,
        profilePicture: doc.profilePicture || "",
        currentRole: doc.currentRole || "",
        company: doc.company || "",
        industry: doc.industry || "",
        yearsOfExperience: doc.yearsOfExperience || 0,
        avgRating: doc.avgRating || 0,
        hourlyRate: doc.hourlyRate || 0,
        skills: doc.skills || [],
    };
};

module.exports = { toMentorProfileDTO, toMentorProfileSummary };