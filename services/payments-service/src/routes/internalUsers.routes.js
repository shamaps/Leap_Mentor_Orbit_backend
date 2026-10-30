const { createUserLifecycleRouter } = require("@leapmentor/shared/utils/userLifecycleRouter");
const { userLifecycleService } = require("../config/container");

module.exports = createUserLifecycleRouter({ service: "payments", handlers: userLifecycleService });