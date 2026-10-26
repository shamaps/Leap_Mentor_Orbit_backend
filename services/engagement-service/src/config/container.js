// services/engagement-service/src/config/container.js
// Dependency wiring for the engagement service only (subset of the monolith's config/container.js).
const logger = require("@leapmentor/shared/utils/logger");
const makeCreateNotification = require("@leapmentor/shared/utils/createNotification");

// ── Repositories (service-owned)
const adminReportsRepo = require("../repositories/adminReports.repository");
const connectRequestRepo = require("../repositories/connectRequest.repository");
const feedbackRepo = require("../repositories/feedback.repository");
const goalRepo = require("../repositories/goal.repository");
const leapRequestRepo = require("../repositories/leapRequest.repository");
const mentorReferRepo = require("../repositories/mentorRefer.repository");
const noteRepo = require("../repositories/note.repository");
const privateNoteRepo = require("../repositories/privateNote.repository");
const reportRepo = require("../repositories/report.repository");
const sessionRepo = require("../repositories/session.repository");
const supportRepo = require("../repositories/support.repository");
// ── Repositories shared with other services (phase 1, see ARCHITECTURE.md 4a)
const notificationRepo = require("@leapmentor/shared/repositories/notification.repository");
const adminEngagementsRepo = require("../repositories/adminEngagements.repository");
const serviceCompensationRepo = require("../repositories/serviceCompensation.repository");
const paymentsClient = require("../clients/payments.client");
const catalogClient = require("../clients/catalog.client");

// ── Service factories
const createAdminReportsService = require("../services/adminReports.service");
const createConnectRequestService = require("../services/connectRequest.service");
const createFeedbackService = require("../services/feedback.service");
const createGoalService = require("../services/goal.service");
const createLeapRequestService = require("../services/leapRequest.service");
const createMentorReferService = require("../services/mentorRefer.service");
const createNoteService = require("../services/note.service");
const createPrivateNoteService = require("../services/privateNote.service");
const createReportService = require("../services/report.service");
const createSessionService = require("../services/session.service");
const createSupportService = require("../services/support.service");
const createAdminEngagementsService = require("../services/adminEngagements.service");
const createServiceCompensationService = require("../services/serviceCompensation.service");

// ── Controller factories
const createAdminReportsController = require("../controllers/admin/adminReports.controller");
const createConnectRequestController = require("../controllers/connectRequest.controller");
const createFeedbackController = require("../controllers/feedback.controller");
const createGoalController = require("../controllers/goal.controller");
const createLeapRequestController = require("../controllers/leapRequest.controller");
const createMentorReferController = require("../controllers/mentorRefer.controller");
const createNoteController = require("../controllers/note.controller");
const createPrivateNoteController = require("../controllers/privateNote.controller");
const createReportController = require("../controllers/report.controller");
const createSessionController = require("../controllers/session.controller");
const createSupportController = require("../controllers/support.controller");
const createAdminEngagementsController = require("../controllers/admin/adminEngagements.controller");

// ── Wire services
const createNotification = makeCreateNotification(notificationRepo);
const serviceCompensation = createServiceCompensationService(serviceCompensationRepo, { paymentsClient, catalogClient, sessionRepo, logger });

const adminReportsService = createAdminReportsService(adminReportsRepo, { logger, createNotification, compensationService: serviceCompensation });
const connectRequestService = createConnectRequestService(connectRequestRepo, { logger, createNotification, catalogClient, serviceCompensation });
const feedbackService = createFeedbackService(feedbackRepo, { logger, compensationService: serviceCompensation });
const goalService = createGoalService(goalRepo, { logger });
const leapRequestService = createLeapRequestService(leapRequestRepo, { logger, paymentsClient });
const mentorReferService = createMentorReferService(mentorReferRepo, { logger });
const noteService = createNoteService(noteRepo, { logger });
const privateNoteService = createPrivateNoteService(privateNoteRepo, { logger });
const reportService = createReportService(reportRepo, { logger });
const sessionService = createSessionService(sessionRepo, serviceCompensation, { logger });
const supportService = createSupportService(supportRepo, { logger });
const adminEngagementsService = createAdminEngagementsService(adminEngagementsRepo);

// ── Wire controllers
module.exports = {
    adminReportsController: createAdminReportsController(adminReportsService, { logger }),
    connectRequestController: createConnectRequestController(connectRequestService, { logger }),
    feedbackController: createFeedbackController(feedbackService, { logger }),
    goalController: createGoalController(goalService, { logger }),
    leapRequestController: createLeapRequestController(leapRequestService, { logger }),
    mentorReferController: createMentorReferController(mentorReferService, { logger }),
    noteController: createNoteController(noteService, { logger }),
    privateNoteController: createPrivateNoteController(privateNoteService, { logger }),
    reportController: createReportController(reportService, { logger }),
    sessionController: createSessionController(sessionService, { logger }),
    supportController: createSupportController(supportService, { logger }),
    adminEngagementsController: createAdminEngagementsController(adminEngagementsService, { logger }),
    serviceCompensation,
};
