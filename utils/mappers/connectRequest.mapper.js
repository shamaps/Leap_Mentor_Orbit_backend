// Frontend reads (confirmed from component audit):
// _id, status, message, selectedSlots, confirmedSlot, totalAmount,
// paidAt, sessionRate, sessionCount, paymentStatus, mentorProfile,
// menteeProfile, mentor.name, mentee.name, viewerRole

const { toMentorProfileSummary } = require("./mentorProfile.mapper");
const { toMenteeProfileSummary } = require("./menteeProfile.mapper");

const toConnectRequestSummary = (doc) => ({
    id: doc._id,
    _id: doc._id,
    status: doc.status,
    message: doc.message,
    requestedAt: doc.requestedAt,
    sessionRate: doc.sessionRate,
    sessionCount: doc.sessionCount,
    totalAmount: doc.totalAmount,
    paymentStatus: doc.paymentStatus,
    paidAt: doc.paidAt,
    selectedSlots: doc.selectedSlots,
    confirmedSlot: doc.confirmedSlot,
    mentor: doc.mentor ? {
        id: doc.mentor._id,
        _id: doc.mentor._id,
        name: doc.mentor.name,
        email: doc.mentor.email,
    } : null,
    mentee: doc.mentee ? {
        id: doc.mentee._id,
        _id: doc.mentee._id,
        name: doc.mentee.name,
        email: doc.mentee.email,
    } : null,
    mentorProfile: toMentorProfileSummary(doc.mentorProfile) || null,
    menteeProfile: toMenteeProfileSummary(doc.menteeProfile) || null,
    referredToProfile: toMentorProfileSummary(doc.referredToProfile) || null,
    referredByProfile: toMentorProfileSummary(doc.referredByProfile) || null,
});
// Stripped: commissionRate, commissionAmount, mentorPayout (internal finance),
//           referredRequestId, isDeleted, __v, updatedAt

const toConnectRequestDetail = (doc) => ({
    ...toConnectRequestSummary(doc),
    additionalSlots: doc.additionalSlots || [],
    viewerRole: doc.viewerRole,
    completedAt: doc.completedAt,
});

const toConnectRequestList = (docs) => docs.map(toConnectRequestSummary);

module.exports = { toConnectRequestSummary, toConnectRequestDetail, toConnectRequestList };