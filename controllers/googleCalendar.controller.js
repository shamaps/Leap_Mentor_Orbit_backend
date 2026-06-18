// controllers/googleCalendar.controller.js
const { ok, noContent } = require("../utils/response");
const createGoogleCalendarController = (service, { logger }) => {

// GET /api/google-calendar/auth-url


/**
 * Returns the Google OAuth URL for the logged-in mentor.
 */
const getAuthUrl = async (req, res, next) => {
  try {
    const url = await service.getAuthUrl(req.user._id);
    logger.info("getAuthUrl completed successfully");
    return ok(res, { url });
  } catch (err) {
    logger.error("Unhandled error in googleCalendar.controller", { error: err.message, stack: err.stack });
    next(err);
  
    
}
};


// GET /api/google-calendar/callback  (no auth — Google redirects here)


/**
 * Handles Google OAuth callback.
 * Responds with an inline script that postMessages to the opener window.
 */
const handleCallback = async (req, res, next) => {
  const { code, state, error } = req.query;

  // Google denied access
  if (error) {
    logger.error("❌ Google OAuth denied:", error);
    logger.info("handleCallback completed successfully");
    return res.send(`
      <script>
        window.opener?.postMessage({ type: "GOOGLE_CALENDAR_ERROR", error: "${error}" }, "*");
        window.close();
      </script>
    `);
  }

  try {
    await service.handleCallback(code, state);

    logger.info("handleCallback completed successfully");
    return res.send(`
      <script>
        window.opener?.postMessage({ type: "GOOGLE_CALENDAR_CONNECTED" }, "*");
        window.close();
      </script>
    `);
  } catch (err) {
    logger.error("❌ Google Calendar callback error:", err.message, err?.response?.data);
    const safeError = encodeURIComponent(err.message);
    logger.info("handleCallback completed successfully");
    return res.send(`
      <script>
        window.opener?.postMessage({ type: "GOOGLE_CALENDAR_ERROR", error: decodeURIComponent("${safeError}") }, "*");
        window.close();
      </script>
    `);
  }
};


// POST /api/google-calendar/disconnect


/**
 * Disconnects Google Calendar for the logged-in mentor.
 */
const disconnect = async (req, res, next) => {
  try {
    await service.disconnect(req.user._id);
    logger.info("disconnect completed successfully");
    return noContent(res);
  } catch (err) {
     logger.error("Unhandled error in googleCalendar.controller", { error: err.message, stack: err.stack });
    next(err);
}
};


// GET /api/google-calendar/busy?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD


/**
 * Returns busy slots from the mentor's primary Google Calendar.
 */
const getBusySlots = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const busy = await service.getBusySlots(req.user._id, startDate, endDate);
    logger.info("getBusySlots completed successfully");
    return ok(res, { busy });
  } catch (err) {
    logger.error("Unhandled error in googleCalendar.controller", { error: err.message, stack: err.stack });
    next(err);
}
};


// GET /api/google-calendar/events?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD


/**
 * Returns events from all accessible Google Calendars, deduplicated.
 */
const getEvents = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const events = await service.getEvents(req.user._id, startDate, endDate);
    logger.info("getEvents completed successfully");
    return ok(res, { events });
  } catch (err) {
    logger.error("Unhandled error in googleCalendar.controller", { error: err.message, stack: err.stack });
    next(err);
  
    
}
};

  return { getAuthUrl, handleCallback, disconnect, getBusySlots, getEvents };
};
module.exports = createGoogleCalendarController;