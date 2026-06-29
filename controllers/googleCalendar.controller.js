// controllers/googleCalendar.controller.js
const { ok, noContent } = require("../utils/response");
const crypto = require("node:crypto");
const { handleError } = require("../utils/appError");

/**
 * @typedef {Object} GoogleCalendarService
 * @property {(userId: any) => Promise<string>} getAuthUrl - Assembles integration entry redirect strings.
 * @property {(userId: any) => Promise<boolean>} getStatus - Resolves integration link verification flags.
 * @property {(code: string, state: string) => Promise<void>} handleCallback - Negotiates access authorizations keys.
 * @property {(mentorId: any) => Promise<void>} disconnect - Drops persistent synchronization boundaries.
 * @property {(mentorId: any, start: string, end: string) => Promise<Object[]>} getBusySlots - Maps blocked primary timelines.
 * @property {(mentorId: any, start: string, end: string) => Promise<Object[]>} getEvents - Compiles parallel calendar arrays.
 */

/**
 * Factory assembling presentation layer middleware handlers processing HTTP network operations for calendar routing.
 * * @param {GoogleCalendarService} service - Underlying synchronization worker service orchestration layer.
 * @param {{ logger: Object }} dependencies - Metric context trace logging framework capturing analytics.
 * @returns {Object} Grouped controller handlers route callback maps blueprint.
 */
const createGoogleCalendarController = (service, { logger }) => {
  const { escapeHtml } = require("../utils/escapeHtml");

  /**
   * Express Route Handler reading authentication setup parameters to return Google initialization redirect links.
   * * @async
   * @function getAuthUrl
   * @param {import('express').Request & { user: { _id: any } }} req - Secure network input context holding session identifiers.
   * @param {import('express').Response} res - Standard connection output return pipe layer interface.
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

  /**
   * Express Route Handler rendering link verification flags representing account association setups.
   * * @async
   * @function getStatus
   * @param {import('express').Request & { user: { _id: any } }} req - Input message frame containing credentials pointers.
   * @param {import('express').Response} res - Standard output return pipe adapter socket.
   */
  const getStatus = async (req, res) => {
    try {
      const connected = await service.getStatus(req.user._id);
      return ok(res, { connected });
    } catch (err) {
      return handleError(res, err, "googleCalendar.handleCallback");
    }
  };

  /**
   * Express Route Handler receiving authorization redirection indicators to persist target access mappings.
   * Dispatches content frames backed by explicit script nonces executing opener communications window postMessages.
   * * @async
   * @function handleCallback
   * @param {import('express').Request} req - Redirection entry message package parsing query variables.
   * @param {import('express').Response} res - Return communication connection transport socket pipe channel.
   */
  const handleCallback = async (req, res) => {
    const { code, state, error } = req.query;
    const nonce = crypto.randomBytes(16).toString("base64");

    res.setHeader("Content-Security-Policy", `script-src 'nonce-${nonce}'`);

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

  /**
   * Express Route Handler disconnecting account linkage criteria elements completely.
   * * @async
   * @function disconnect
   * @param {import('express').Request & { user: { _id: any } }} req - Active secure connection manipulation request container.
   * @param {import('express').Response} res - Pipeline closure response adaptor.
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

  /**
   * Express Route Handler mapping blocked operational bounds resolved on the primary sync calendar.
   * * @async
   * @function getBusySlots
   * @param {import('express').Request & { user: { _id: any } }} req - Request block tracking range metrics query parameters.
   * @param {import('express').Response} res - Operational output return interface pipe context.
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

  /**
   * Express Route Handler extracting deduplicated schedules parallel-harvested across all readable directories.
   * * @async
   * @function getEvents
   * @param {import('express').Request & { user: { _id: any } }} req - Operational environment request parsing query constraints.
   * @param {import('express').Response} res - Data structural transformation returning connector socket.
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