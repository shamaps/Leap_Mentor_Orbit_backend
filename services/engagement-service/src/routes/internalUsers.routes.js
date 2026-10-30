const { createUserLifecycleRouter } = require("@leapmentor/shared/utils/userLifecycleRouter");
const { internalUsersService } = require("../config/container");

module.exports = createUserLifecycleRouter({ service: "engagement", handlers: internalUsersService });