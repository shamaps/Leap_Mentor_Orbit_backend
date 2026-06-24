// controllers/googleCalendar.controller.js
const { ok, noContent } = require("../utils/response");
const crypto = require("node:crypto");
const { handleError } = require("../utils/appError");
const createGoogleCalendarController = (service, { logger }) => {
  const { escapeHtml } = require("../utils/escapeHtml"); 
// GET /api/google-calendar/auth-url
/**
 * Returns the Google OAuth URL for the logged-in mentor.
 */
const getAuthUrl = async (req, res) => {
  try {
    const url = await service.getAuthUrl(req.user._id);
    logger.info("getAuthUrl completed successfully");
    return ok(res, { url });
  } catch (err) {
    return handleError(res, err, "googleCalendar.getAuthUrl");
  }
};

  const getStatus = async (req, res) => {
    try {
      const connected = await service.getStatus(req.user._id);
      return ok(res, { connected });
    } catch (err) {
      return handleError(res, err, "googleCalendar.handleCallback");
        }
  };
 
// GET /api/google-calendar/callback  (no auth — Google redirects here)
/**
 * Handles Google OAuth callback.
 * Responds with an inline script that postMessages to the opener window.
 */
  const handleCallback = async (req, res) => {
    const { code, state, error } = req.query;
    const nonce = crypto.randomBytes(16).toString("base64");

    res.setHeader("Content-Security-Policy", `script-src 'nonce-${nonce}'`);

    // Google denied access
    if (error) {
      logger.warn("Google OAuth access denied", { error: error?.message });
      logger.info("handleCallback completed successfully");
      return res.send(`
      <script nonce="${nonce}">
        window.opener?.postMessage({ type: "GOOGLE_CALENDAR_ERROR", error: "${escapeHtml(error)}"}, "*");
        window.close();
      </script>
    `);
    }
    try {
      await service.handleCallback(code, state);
      logger.info("handleCallback completed successfully");
      return res.send(`
      <script nonce="${nonce}">
        window.opener?.postMessage({ type: "GOOGLE_CALENDAR_CONNECTED" }, "*");
        window.close();
      </script>
    `);
    } catch (err) {
      logger.error("Google Calendar callback error", { error: err.message, responseData: err?.response?.data });
      const safeError = encodeURIComponent("Google Calendar connection failed. Please try again.");
      logger.info("handleCallback completed successfully");
      return res.send(`
      <script nonce="${nonce}">
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
const disconnect = async (req, res) => {
  try {
    await service.disconnect(req.user._id);
    logger.info("disconnect completed successfully");
    return noContent(res);
  } catch (err) {
    return handleError(res, err, "googleCalendar.getBusySlots");
  }
};


// GET /api/google-calendar/busy?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD


/**
 * Returns busy slots from the mentor's primary Google Calendar.
 */
const getBusySlots = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const busy = await service.getBusySlots(req.user._id, startDate, endDate);
    logger.info("getBusySlots completed successfully");
    return ok(res, { busy });
  } catch (err) {
    return handleError(res, err, "googleCalendar.getEvents");
}
};


// GET /api/google-calendar/events?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD


/**
 * Returns events from all accessible Google Calendars, deduplicated.
 */
const getEvents = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const events = await service.getEvents(req.user._id, startDate, endDate);
    logger.info("getEvents completed successfully");
    return ok(res, { events });
  } catch (err) {
    return handleError(res, err, "googleCalendar.disconnect");
}
};

 return { getAuthUrl, handleCallback, disconnect, getBusySlots, getEvents, getStatus };
};
module.exports = createGoogleCalendarController;