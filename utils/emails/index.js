// utils/emails/index.js — barrel file, existing code imports from here
const { sendConnectRequestEmail, sendRequestAcceptedEmail } = require("./connectRequestEmails");
const { sendPaymentReceivedEmail, sendDocumentsSubmittedEmail, sendMentorVerifiedEmail } = require("./paymentEmails");
const { sendSlotCancelledEmail, sendSlotRescheduledEmail, sendAdditionalSlotEmail } = require("./sessionEmails");
const { sendSupportResolvedEmail, sendReportSubmittedEmail, sendReportResolvedEmail } = require("./adminEmails");

module.exports = {
    sendConnectRequestEmail, sendRequestAcceptedEmail,
    sendPaymentReceivedEmail, sendDocumentsSubmittedEmail, sendMentorVerifiedEmail,
    sendSlotCancelledEmail, sendSlotRescheduledEmail, sendAdditionalSlotEmail,
    sendSupportResolvedEmail, sendReportSubmittedEmail, sendReportResolvedEmail,
};