// config/container.js
const logger = require("../utils/logger");

// ── Repositories
const adminRepo = require("../repositories/admin.repository");
const adminPaymentsRepo = require("../repositories/adminPayments.repository");
const adminReportsRepo = require("../repositories/adminReports.repository");
const adminSettingsRepo = require("../repositories/adminSettings.repository");
const adminVerificationRepo = require("../repositories/adminVerification.repository");
const availabilityRepo = require("../repositories/availability.repository");
const changePasswordRepo = require("../repositories/changePassword.repository");
const clerkSSORepo = require("../repositories/clerkSSO.repository");
const connectRequestRepo = require("../repositories/connectRequest.repository");
const earningsRepo = require("../repositories/earnings.repository");
const escrowRepo = require("../repositories/escrow.repository");
const feedbackRepo = require("../repositories/feedback.repository");
const forgotPasswordRepo = require("../repositories/forgotPassword.repository");
const goalRepo = require("../repositories/goal.repository");
const googleAuthRepo = require("../repositories/googleAuth.repository");
const googleCalendarRepo = require("../repositories/googleCalendar.repository");
const invoiceRepo = require("../repositories/invoice.repository");
const leapRequestRepo = require("../repositories/leapRequest.repository");
const loginRepo = require("../repositories/login.repository");
const menteeProfileRepo = require("../repositories/menteeProfile.repository");
const mentorProfileRepo = require("../repositories/mentorProfile.repository");
const mentorReferRepo = require("../repositories/mentorRefer.repository");
const mentorSearchRepo = require("../repositories/mentorSearch.repository");
const messageRepo = require("../repositories/message.repository");
const noteRepo = require("../repositories/note.repository");
const notificationRepo = require("../repositories/notification.repository");
const privateNoteRepo = require("../repositories/privateNote.repository");
const pushSubscriptionRepo = require("../repositories/pushSubscription.repository");
const registerRepo = require("../repositories/register.repository");
const reportRepo = require("../repositories/report.repository");
const sessionRepo = require("../repositories/session.repository");
const slotLockRepo = require("../repositories/slotLock.repository");
const supportRepo = require("../repositories/support.repository");
const uploadRepo = require("../repositories/upload.repository");
const verificationRepo = require("../repositories/verification.repository");

// ── Service factories
const createAdminService = require("../services/admin.service");
const createAdminPaymentsService = require("../services/adminPayments.service");
const createAdminReportsService = require("../services/adminReports.service");
const createAdminSettingsService = require("../services/adminSettings.service");
const createAdminVerificationService = require("../services/adminVerification.service");
const createAvailabilityService = require("../services/availability.service");
const createChangePasswordService = require("../services/changePassword.service");
const createClerkSSOService = require("../services/clerkSSO.service");
const createConnectRequestService = require("../services/connectRequest.service");
const createEarningsService = require("../services/earnings.service");
const createEscrowService = require("../services/escrow.service");
const createFeedbackService = require("../services/feedback.service");
const createForgotPasswordService = require("../services/forgotPassword.service");
const createGoalService = require("../services/goal.service");
const createGoogleAuthService = require("../services/googleAuth.service");
const createGoogleCalendarService = require("../services/googleCalendar.service");
const createInvoiceService = require("../services/invoice.service");
const createLeapRequestService = require("../services/leapRequest.service");
const createLoginService = require("../services/login.service");
const createMenteeProfileService = require("../services/menteeProfile.service");
const createMentorProfileService = require("../services/mentorProfile.service");
const createMentorReferService = require("../services/mentorRefer.service");
const createMentorSearchService = require("../services/mentorSearch.service");
const createMessageService = require("../services/message.service");
const createNoteService = require("../services/note.service");
const createNotificationService = require("../services/notification.service");
const createPrivateNoteService = require("../services/privateNote.service");
const createPushSubscriptionService = require("../services/pushSubscription.service");
const createRegisterService = require("../services/register.service");
const createReportService = require("../services/report.service");
const createSessionService = require("../services/session.service");
const createSlotLockService = require("../services/slotLock.service");
const createSupportService = require("../services/support.service");
const createUploadService = require("../services/upload.service");
const createVerificationService = require("../services/verification.service");
const createWalletWithdrawalService = require("../services/walletWithdrawal.service");

// ── Controller factories
const createAdminController = require("../controllers/admin.controller");
const createAdminVerificationController = require("../controllers/adminVerification.controller");
const createAvailabilityController = require("../controllers/availability.controller");
const createChangePasswordController = require("../controllers/changePassword.controller");
const createClerkSSOController = require("../controllers/clerkSSO.controller");
const createConnectRequestController = require("../controllers/connectRequest.controller");
const createEarningsController = require("../controllers/earnings.controller");
const createEscrowController = require("../controllers/escrow.controller");
const createFeedbackController = require("../controllers/feedback.controller");
const createForgotPasswordController = require("../controllers/forgotPassword.controller");
const createGoalController = require("../controllers/goal.controller");
const createGoogleAuthController = require("../controllers/googleAuth.controller");
const createGoogleCalendarController = require("../controllers/googleCalendar.controller");
const createInvoiceController = require("../controllers/invoice.controller");
const createLeapRequestController = require("../controllers/leapRequest.controller");
const createLoginController = require("../controllers/login.controller");
const createMenteeProfileController = require("../controllers/menteeProfile.controller");
const createMentorProfileController = require("../controllers/mentorProfile.controller");
const createMentorReferController = require("../controllers/mentorRefer.controller");
const createMentorSearchController = require("../controllers/mentorSearch.controller");
const createMessageController = require("../controllers/message.controller");
const createNoteController = require("../controllers/note.controller");
const createNotificationController = require("../controllers/notification.controller");
const createPrivateNoteController = require("../controllers/privateNote.controller");
const createPushSubscriptionController = require("../controllers/pushSubscription.controller");
const createRegisterController = require("../controllers/register.controller");
const createReportController = require("../controllers/report.controller");
const createSessionController = require("../controllers/session.controller");
const createSlotLockController = require("../controllers/slotLock.controller");
const createSupportController = require("../controllers/support.controller");
const createUploadController = require("../controllers/upload.controller");
const createVerificationController = require("../controllers/verification.controller");
const createAdminPaymentsController = require("../controllers/admin/adminPayments.controller");
const createAdminReportsController = require("../controllers/admin/adminReports.controller");
const createAdminSettingsController = require("../controllers/admin/adminSettings.controller");

// ── Wire services
const adminService = createAdminService(adminRepo, { logger });
const adminPaymentsService = createAdminPaymentsService(adminPaymentsRepo, { logger });
const adminReportsService = createAdminReportsService(adminReportsRepo, { logger });
const adminSettingsService = createAdminSettingsService(adminSettingsRepo, { logger });
const adminVerificationService = createAdminVerificationService(adminVerificationRepo, { logger });
const availabilityService = createAvailabilityService(availabilityRepo, { logger });
const changePasswordService = createChangePasswordService(changePasswordRepo, { logger });
const clerkSSOService = createClerkSSOService(clerkSSORepo, { logger });
const connectRequestService = createConnectRequestService(connectRequestRepo, { logger });
const earningsService = createEarningsService(earningsRepo, { logger });
const escrowService = createEscrowService(escrowRepo, { logger });
const feedbackService = createFeedbackService(feedbackRepo, { logger });
const forgotPasswordService = createForgotPasswordService(forgotPasswordRepo, { logger });
const goalService = createGoalService(goalRepo, { logger });
const googleAuthService = createGoogleAuthService(googleAuthRepo, { logger });
const googleCalendarService = createGoogleCalendarService(googleCalendarRepo, { logger });
const invoiceService = createInvoiceService(invoiceRepo, { logger });
const leapRequestService = createLeapRequestService(leapRequestRepo, { logger });
const loginService = createLoginService(loginRepo, { logger });
const menteeProfileService = createMenteeProfileService(menteeProfileRepo, { logger });
const mentorProfileService = createMentorProfileService(mentorProfileRepo, { logger });
const mentorReferService = createMentorReferService(mentorReferRepo, { logger });
const mentorSearchService = createMentorSearchService(mentorSearchRepo, { logger });
const messageService = createMessageService(messageRepo, { logger });
const noteService = createNoteService(noteRepo, { logger });
const notificationService = createNotificationService(notificationRepo, { logger });
const privateNoteService = createPrivateNoteService(privateNoteRepo, { logger });
const pushSubscriptionService = createPushSubscriptionService(pushSubscriptionRepo, { logger });
const registerService = createRegisterService(registerRepo, { logger });
const reportService = createReportService(reportRepo, { logger });
const sessionService = createSessionService(sessionRepo, { logger });
const slotLockService = createSlotLockService(slotLockRepo, { logger });
const supportService = createSupportService(supportRepo, { logger });
const uploadService = createUploadService(uploadRepo, { logger });
const verificationService = createVerificationService(verificationRepo, { logger });
const walletWithdrawalService = createWalletWithdrawalService(earningsRepo, { logger });

// ── Wire controllers
module.exports = {
    adminController: createAdminController(adminService, { logger }),
    adminVerificationController: createAdminVerificationController(adminVerificationService, { logger }),
    availabilityController: createAvailabilityController(availabilityService, { logger }),
    changePasswordController: createChangePasswordController(changePasswordService, { logger }),
    clerkSSOController: createClerkSSOController(clerkSSOService, { logger }),
    connectRequestController: createConnectRequestController(connectRequestService, { logger }),
    earningsController: createEarningsController(earningsService, walletWithdrawalService, { logger }),
    escrowController: createEscrowController(escrowService, { logger }),
    feedbackController: createFeedbackController(feedbackService, { logger }),
    forgotPasswordController: createForgotPasswordController(forgotPasswordService, { logger }),
    goalController: createGoalController(goalService, { logger }),
    googleAuthController: createGoogleAuthController(googleAuthService, { logger }),
    googleCalendarController: createGoogleCalendarController(googleCalendarService, { logger }),
    invoiceController: createInvoiceController(invoiceService, { logger }),
    leapRequestController: createLeapRequestController(leapRequestService, { logger }),
    loginController: createLoginController(loginService, { logger }),
    menteeProfileController: createMenteeProfileController(menteeProfileService, { logger }),
    mentorProfileController: createMentorProfileController(mentorProfileService, { logger }),
    mentorReferController: createMentorReferController(mentorReferService, { logger }),
    mentorSearchController: createMentorSearchController(mentorSearchService, { logger }),
    messageController: createMessageController(messageService, { logger }),
    noteController: createNoteController(noteService, { logger }),
    notificationController: createNotificationController(notificationService, { logger }),
    privateNoteController: createPrivateNoteController(privateNoteService, { logger }),
    pushSubscriptionController: createPushSubscriptionController(pushSubscriptionService, { logger }),
    registerController: createRegisterController(registerService, { logger }),
    reportController: createReportController(reportService, { logger }),
    sessionController: createSessionController(sessionService, { logger }),
    slotLockController: createSlotLockController(slotLockService, { logger }),
    supportController: createSupportController(supportService, { logger }),
    uploadController: createUploadController(uploadService, { logger }),
    verificationController: createVerificationController(verificationService, { logger }),
    adminPaymentsController: createAdminPaymentsController(adminPaymentsService, { logger }),
    adminReportsController: createAdminReportsController(adminReportsService, { logger }),
    adminSettingsController: createAdminSettingsController(adminSettingsService, { logger }),
};