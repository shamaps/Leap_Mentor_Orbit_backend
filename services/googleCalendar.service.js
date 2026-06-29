// services/googleCalendar.service.js
const { google } = require("googleapis");
const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];
const { withTimeout } = require("../utils/withTimeout");
const { withRetry } = require("../utils/withRetry");
const { getTraceId } = require("../utils/requestContext");
const config = require("../config/env");

/**
 * @typedef {Object} GoogleCalendarRepository
 * @property {(mentorId: any) => Promise<Object|null>} findAvailabilityWithToken - Resolves dynamic configuration mapping along with unencrypted credentials data records.
 * @property {(mentorId: any, tokenJson: string) => Promise<Object>} saveCalendarToken - Upserts credentials parameters enabling active channel tracking.
 * @property {(mentorId: any, tokenJson: string) => Promise<Object>} updateCalendarToken - Direct overwrite update used during auto-rotation cycles.
 * @property {(mentorId: any) => Promise<Object>} disconnectCalendar - Drops integration visibility flags and erases authorization string criteria.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string, meta?: Object) => void} info
 * @property {(message: string) => void} warn
 * @property {(message: string, error: any) => void} error
 */

/**
 * Factory function implementing the core business logic orchestration layer for Google Calendar integration.
 * * @param {GoogleCalendarRepository} repo - Data persistence wrapper adapter instance.
 * @param {{ logger: Logger }} dependencies - Application performance tracing monitoring facility parameters.
 * @returns {Object} Grouped business validation functionalities map layout.
 */
const createGoogleCalendarService = (repo, { logger }) => {

    /**
     * Instantiates an unconfigured base OAuth2 credential exchange client wrapper using core system configurations.
     * * @private
     * @function createOAuthClient
     * @returns {import('google-auth-library').OAuth2Client} Fresh un-credentialed auth client wrapper instance context.
     */
    const createOAuthClient = () =>
        new google.auth.OAuth2(
            config.googleClientId,
            config.googleClientSecret,
            config.googleRedirectUri
        );

    /**
     * Mounts stored token variables onto a fresh transport client, attaching lifecycle event rotation listeners.
     * * @private
     * @function buildAuthenticatedClient
     * @param {Object} tokens - Deserialized authorization criteria key token properties container.
     * @param {any} mentorId - System indicator identifier mapping target profile rows.
     * @returns {import('google-auth-library').OAuth2Client} Authenticated client instance wrapper ready for API interaction.
     */
    const buildAuthenticatedClient = (tokens, mentorId) => {
        const client = createOAuthClient();
        client.setCredentials(tokens);

        client.on("tokens", async (newTokens) => {
            const merged = { ...tokens, ...newTokens };
            await repo.updateCalendarToken(mentorId, JSON.stringify(merged));
        });

        return client;
    };

    /**
     * Decodes and validates stored string payloads tracking active authentication tokens.
     * * @private
     * @function parseTokens
     * @param {string} tokenJson - Crypto-decrypted raw string payload.
     * @throws {AppError} 500 - If structural parsing evaluations catch corruption faults.
     * @returns {Object} Deserialized authorization parameters layout object map.
     */
    const parseTokens = (tokenJson) => {
        try {
            return JSON.parse(tokenJson);
        } catch {
            throw new AppError(500, "Stored Google token is corrupted");
        }
    };

    /**
     * Resolves connection status booleans tracking whether user configurations retain valid link targets.
     * * @async
     * @function getStatus
     * @param {any} userId - Target account validation lookup parameter index key string.
     * @returns {Promise<boolean>} True if channels are verified and properties are initialized.
     */
    const getStatus = async (userId) => {
        const avail = await repo.findAvailabilityWithToken(userId);
        return !!(avail?.googleCalendarConnected && avail?.googleCalendarToken);
    };

    /**
     * Assembles a base64 state parameter to generate secure authentication redirect URLs.
     * * @async
     * @function getAuthUrl
     * @param {any} userId - Destination profile originator identifier tracking records.
     * @returns {Promise<string>} Fully prepared external destination authorization route link string.
     */
    const getAuthUrl = async (userId) => {
        const client = createOAuthClient();
        const state = Buffer.from(JSON.stringify({ userId })).toString("base64");

        return client.generateAuthUrl({
            access_type: "offline",
            scope: SCOPES,
            prompt: "consent",
            state,
        });
    };

    /**
     * Decodes base64 redirection payloads, routing authorization codes to settle persistent access maps.
     * * @async
     * @function handleCallback
     * @param {string} code - Redirection exchange verification ticket token emitted by origin sources.
     * @param {string} state - Base64 encoded JSON parameter context containing user validation signatures.
     * @returns {Promise<void>} Processing resolves on completed token exchanges and successful updates.
     */
    const handleCallback = async (code, state) => {
        const { userId } = JSON.parse(Buffer.from(state, "base64").toString());

        const client = createOAuthClient();
        const { tokens } = await withRetry(
            () => withTimeout(client.getToken(code), 8000, "Google token exchange"),
            { retries: 2, label: "Google token exchange" }
        );
        const tokenJson = JSON.stringify(tokens);

        await repo.saveCalendarToken(userId, tokenJson);
    };

    /**
     * Drops connection permissions flags, severing synchronization visibility loops.
     * * @async
     * @function disconnect
     * @param {any} mentorId - Targets active session user token context identifier string.
     * @returns {Promise<void>} Resolves tracking steps on completed record wipes.
     */
    const disconnect = async (mentorId) => {
        await repo.disconnectCalendar(mentorId);
    };

    /**
     * Contacts upstream freebusy endpoint vectors to map absolute timeline collisions across primary calendars.
     * * @async
     * @function getBusySlots
     * @param {any} mentorId - Host target primary profile lookup index key parameter.
     * @param {string} startDate - Range restriction lower bound formatted as "YYYY-MM-DD".
     * @param {string} endDate - Range restriction upper bound formatted as "YYYY-MM-DD".
     * @returns {Promise<Array<{start: string, end: string}>>} Collection array tracking blocked timeline parameters.
     */
    const getBusySlots = async (mentorId, startDate, endDate) => {
        const avail = await repo.findAvailabilityWithToken(mentorId);
        if (!avail?.googleCalendarToken) return [];

        const tokens = parseTokens(avail.googleCalendarToken);
        if (!tokens) return [];

        const client = buildAuthenticatedClient(tokens, mentorId);
        const calendar = google.calendar({ version: "v3", auth: client });

        const timeMin = new Date(`${startDate}T00:00:00Z`).toISOString();
        const timeMax = new Date(`${endDate}T23:59:59Z`).toISOString();
        logger.info("Google Calendar freebusy API call", {
            traceId: getTraceId(),
            mentorId: mentorId?.toString(),
            action: "getBusySlots",
        });
        const freeBusy = await withTimeout(calendar.freebusy.query({
            requestBody: {
                timeMin,
                timeMax,
                items: [{ id: "primary" }],
            },
        }), 10000, "Google freebusy query");

        return freeBusy.data.calendars.primary.busy;
    };

    /**
     * Restructures raw, deep Google payload blocks into simplified application timeline schemas.
     * * @private
     * @function normalizeEvent
     * @param {Object} e - Unfiltered event dictionary chunk emitted by Google API components.
     * @returns {{id: string, summary: string, start: string, end: string, allDay: boolean}} Standardized metric mapping object.
     */
    const normalizeEvent = (e) => ({
        id: e.id,
        summary: e.summary || "Busy",
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        allDay: !e.start?.dateTime,
    });

    /**
     * Interrogates list endpoints matching a single calendar identifier context.
     * Logs unreadable components safely, substituting fallback collections.
     * * @private
     * @async
     * @function fetchEventsFromCalendar
     * @param {Object} context - Extraction options configuration package.
     * @param {Object} context.calendar - Initialized version-locked API worker instance client.
     * @param {string} context.calId - Dynamic channel specific selector string.
     * @param {string} context.timeMin - Calendar minimum range boundary timestamp.
     * @param {string} context.timeMax - Calendar maximum range boundary timestamp.
     * @returns {Promise<Object[]>} Normalised sub-event array structures collection.
     */
    const fetchEventsFromCalendar = async ({ calendar, calId, timeMin, timeMax }) => {
        try {
            logger.info("Google Calendar events.list API call", {
                traceId: getTraceId(),
                calendarId: calId,
                action: "fetchEventsFromCalendar",
            });
            const response = await withTimeout(calendar.events.list({
                calendarId: calId,
                timeMin,
                timeMax,
                singleEvents: true,
                orderBy: "startTime",
                maxResults: 250,
            }), 10000, `Google events.list for calendar ${calId}`);
            return (response.data.items || []).map(normalizeEvent);
        } catch (err) {
            logger.warn(`⚠️ Could not read calendar ${calId} — skipping. Reason: ${err.message}`);
            return [];
        }
    };

    /**
     * Filters out duplicate timeline rows sharing identical key indicators.
     * * @private
     * @function deduplicateEvents
     * @param {Array} events - Combined raw event structures array tracking collections.
     * @returns {Array} Filtered list clear of overlapping identity items.
     */
    const deduplicateEvents = (events) => {
        const seen = new Set();
        return events.filter((e) => {
            if (seen.has(e.id)) return false;
            seen.add(e.id);
            return true;
        });
    };

    /**
     * Aggregates complete schedules parallel-compiled from all user-selected calendar directories.
     * * @async
     * @function getEvents
     * @param {any} mentorId - System target identifier reference tracking owners.
     * @param {string} startDate - Bounding restriction starting floor formatted as "YYYY-MM-DD".
     * @param {string} endDate - Bounding restriction terminating ceiling formatted as "YYYY-MM-DD".
     * @returns {Promise<Object[]>} Aggregated, deduplicated item listings explaining timeline configurations.
     */
    const getEvents = async (mentorId, startDate, endDate) => {
        const avail = await repo.findAvailabilityWithToken(mentorId);
        if (!avail?.googleCalendarToken) return [];

        const tokens = parseTokens(avail.googleCalendarToken);
        if (!tokens) return [];

        const client = buildAuthenticatedClient(tokens, mentorId);
        const calendar = google.calendar({ version: "v3", auth: client });

        const timeMin = new Date(`${startDate}T00:00:00Z`).toISOString();
        const timeMax = new Date(`${endDate}T23:59:59Z`).toISOString();

        const calList = await calendar.calendarList.list();
        const calendarIds = calList.data.items
            .filter((c) => c.selected !== false)
            .map((c) => c.id);

        const eventArrays = await Promise.all(
            calendarIds.map((calId) => withTimeout(fetchEventsFromCalendar({ calendar, calId, timeMin, timeMax }), 10000, `Google events.list for calendar ${calId}`))
        );

        return deduplicateEvents(eventArrays.flat());
    };

    return { getAuthUrl, handleCallback, disconnect, getBusySlots, getEvents, getStatus };
};

module.exports = createGoogleCalendarService;