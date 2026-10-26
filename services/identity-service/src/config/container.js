// services/identity/src/config/container.js
// Dependency wiring for the identity service only (subset of the monolith's config/container.js).
const logger = require("@leapmentor/shared/utils/logger");

// ── Repositories
const adminRepo = require("../repositories/admin.repository");
const adminSettingsRepo = require("../repositories/adminSettings.repository");
const changePasswordRepo = require("../repositories/changePassword.repository");
const clerkSSORepo = require("../repositories/clerkSSO.repository");
const forgotPasswordRepo = require("../repositories/forgotPassword.repository");
const googleAuthRepo = require("../repositories/googleAuth.repository");
const loginRepo = require("../repositories/login.repository");
const refreshTokenRepo = require("../repositories/refreshToken.repository");
const registerRepo = require("../repositories/register.repository");
const verificationRepo = require("../repositories/verification.repository");

// ── Service factories
const createAdminService = require("../services/admin.service");
const createAdminSettingsService = require("../services/adminSettings.service");
const createChangePasswordService = require("../services/changePassword.service");
const createClerkSSOService = require("../services/clerkSSO.service");
const createForgotPasswordService = require("../services/forgotPassword.service");
const createGoogleAuthService = require("../services/googleAuth.service");
const createLoginService = require("../services/login.service");
const createRefreshTokenService = require("../services/refreshToken.service");
const createRegisterService = require("../services/register.service");
const createVerificationService = require("../services/verification.service");

// ── Controller factories
const createAdminController = require("../controllers/admin.controller");
const createAdminSettingsController = require("../controllers/admin/adminSettings.controller");
const createChangePasswordController = require("../controllers/changePassword.controller");
const createClerkSSOController = require("../controllers/clerkSSO.controller");
const createForgotPasswordController = require("../controllers/forgotPassword.controller");
const createGoogleAuthController = require("../controllers/googleAuth.controller");
const createLoginController = require("../controllers/login.controller");
const createRefreshTokenController = require("../controllers/refreshToken.controller");
const createRegisterController = require("../controllers/register.controller");
const createUserController = require("../controllers/user.controller");
const createVerificationController = require("../controllers/verification.controller");

// ── Wire services
const adminService = createAdminService(adminRepo, { logger, refreshTokenRepo });
const adminSettingsService = createAdminSettingsService(adminSettingsRepo, { logger });
const changePasswordService = createChangePasswordService(changePasswordRepo, { logger });
const clerkSSOService = createClerkSSOService(clerkSSORepo, { logger });
const forgotPasswordService = createForgotPasswordService(forgotPasswordRepo, { logger });
const googleAuthService = createGoogleAuthService(googleAuthRepo, { logger });
const loginService = createLoginService(loginRepo, { logger });
const refreshTokenService = createRefreshTokenService(refreshTokenRepo, { logger });
const registerService = createRegisterService(registerRepo, { logger });
const verificationService = createVerificationService(verificationRepo, { logger });

// ── Wire controllers
module.exports = {
  adminController: createAdminController(adminService, { logger }),
  adminSettingsController: createAdminSettingsController(adminSettingsService, { logger }),
  changePasswordController: createChangePasswordController(changePasswordService, { logger }),
  clerkSSOController: createClerkSSOController(clerkSSOService, { logger }),
  forgotPasswordController: createForgotPasswordController(forgotPasswordService, { logger }),
  googleAuthController: createGoogleAuthController(googleAuthService, { logger }),
  loginController: createLoginController(loginService, { logger }),
  refreshTokenController: createRefreshTokenController(refreshTokenService, { logger }),
  registerController: createRegisterController(registerService, { logger }),
  userController: createUserController({ logger }),
  verificationController: createVerificationController(verificationService, { logger }),
};
