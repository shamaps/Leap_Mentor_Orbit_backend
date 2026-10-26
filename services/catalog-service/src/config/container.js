// services/catalog-service/src/config/container.js
// Dependency wiring for the catalog service only (subset of the monolith's config/container.js).
const logger = require("@leapmentor/shared/utils/logger");

// ── Repositories
const adminVerificationRepo = require("../repositories/adminVerification.repository");
const availabilityRepo = require("../repositories/availability.repository");
const googleCalendarRepo = require("../repositories/googleCalendar.repository");
const menteeProfileRepo = require("../repositories/menteeProfile.repository");
const mentorProfileRepo = require("../repositories/mentorProfile.repository");
const mentorSearchRepo = require("../repositories/mentorSearch.repository");
const slotLockRepo = require("../repositories/slotLock.repository");
const internalOperationsRepo = require("../repositories/internalOperations.repository");
const uploadRepo = require("../repositories/upload.repository");

// ── Service factories
const createAdminVerificationService = require("../services/adminVerification.service");
const createAvailabilityService = require("../services/availability.service");
const createGoogleCalendarService = require("../services/googleCalendar.service");
const createMenteeProfileService = require("../services/menteeProfile.service");
const createMentorProfileService = require("../services/mentorProfile.service");
const createMentorSearchService = require("../services/mentorSearch.service");
const createSlotLockService = require("../services/slotLock.service");
const createInternalOperationsService = require("../services/internalOperations.service");
const createUploadService = require("../services/upload.service");
const createImageService = require("../services/image.service");

// ── Controller factories
const createAdminVerificationController = require("../controllers/adminVerification.controller");
const createAvailabilityController = require("../controllers/availability.controller");
const createGoogleCalendarController = require("../controllers/googleCalendar.controller");
const createMenteeProfileController = require("../controllers/menteeProfile.controller");
const createMentorProfileController = require("../controllers/mentorProfile.controller");
const createMentorSearchController = require("../controllers/mentorSearch.controller");
const createSlotLockController = require("../controllers/slotLock.controller");
const createUploadController = require("../controllers/upload.controller");
const createImageController = require("../controllers/image.controller");

// ── Wire services
const adminVerificationService = createAdminVerificationService(adminVerificationRepo, { logger });
const availabilityService = createAvailabilityService(availabilityRepo, { logger });
const googleCalendarService = createGoogleCalendarService(googleCalendarRepo, { logger });
const menteeProfileService = createMenteeProfileService(menteeProfileRepo, { logger });
const mentorProfileService = createMentorProfileService(mentorProfileRepo, { logger });
const mentorSearchService = createMentorSearchService(mentorSearchRepo, { logger });
const slotLockService = createSlotLockService(slotLockRepo, { logger });
const internalOperationsService = createInternalOperationsService(internalOperationsRepo, slotLockService);
const uploadService = createUploadService(uploadRepo, { logger });
const imageService = createImageService({ logger });

// ── Wire controllers
module.exports = {
    adminVerificationController: createAdminVerificationController(adminVerificationService, { logger }),
    availabilityController: createAvailabilityController(availabilityService, { logger }),
    googleCalendarController: createGoogleCalendarController(googleCalendarService, { logger }),
    menteeProfileController: createMenteeProfileController(menteeProfileService, { logger }),
    mentorProfileController: createMentorProfileController(mentorProfileService, { logger }),
    mentorSearchController: createMentorSearchController(mentorSearchService, { logger }),
    slotLockController: createSlotLockController(slotLockService, { logger }),
    internalOperationsService,
    uploadController: createUploadController(uploadService, { logger }),
    imageController: createImageController(imageService, { logger }),
};
