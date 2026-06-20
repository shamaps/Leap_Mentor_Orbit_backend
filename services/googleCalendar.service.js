// services/googleCalendar.service.js
const { google } = require("googleapis");
const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];
const { withTimeout } = require("../utils/withTimeout");
const createGoogleCalendarService = (repo, { logger }) => {

/**
 * Create a base OAuth2 client using env credentials.
 * @returns {google.auth.OAuth2}
 */
const createOAuthClient = () =>
    new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );

/**
 * Build an authenticated OAuth2 client from stored tokens.
 * Registers a token refresh listener that persists new tokens automatically.
 *
 * @param {Object}   tokens   - parsed token object from DB
 * @param {ObjectId} mentorId - used to persist refreshed tokens
 * @returns {google.auth.OAuth2}
 */
const buildAuthenticatedClient = (tokens, mentorId) => {
    const client = createOAuthClient();
    client.setCredentials(tokens);

    // Auto-refresh: persist new tokens when Google rotates them
    client.on("tokens", async (newTokens) => {
        const merged = { ...tokens, ...newTokens };
        await repo.updateCalendarToken(mentorId, JSON.stringify(merged));
    });

    return client;
};

/**
 * Parse stored token JSON safely.
 * @param {string} tokenJson
 * @returns {Object|null}
 */
const parseTokens = (tokenJson) => {
    try {
        return JSON.parse(tokenJson);
    } catch {
        return null;
    }
};

    const getStatus = async (userId) => {
        const avail = await repo.findAvailabilityWithToken(userId);
        return !!(avail?.googleCalendarConnected && avail?.googleCalendarToken);
    };
// getAuthUrl


/**
 * Generate Google OAuth URL with userId encoded in state param.
 * @param {ObjectId} userId
 * @returns {Promise<string>} url
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


// handleCallback


/**
 * Exchange Google OAuth code for tokens and persist them.
 * @param {string} code  - from Google callback query
 * @param {string} state - base64 encoded { userId }
 * @returns {Promise<void>}
 */
const handleCallback = async (code, state) => {
    const { userId } = JSON.parse(Buffer.from(state, "base64").toString());

    const client = createOAuthClient();
    const { tokens } = await withTimeout(client.getToken(code), 8000, "Google token exchange");
    const tokenJson = JSON.stringify(tokens);

    await repo.saveCalendarToken(userId, tokenJson);
};


// disconnect


/**
 * Disconnect Google Calendar for a mentor.
 * @param {ObjectId} mentorId
 * @returns {Promise<void>}
 */
const disconnect = async (mentorId) => {
    await repo.disconnectCalendar(mentorId);
};


// getBusySlots


/**
 * Fetch busy time slots from Google Calendar freebusy API.
 * @param {ObjectId} mentorId
 * @param {string}   startDate - YYYY-MM-DD
 * @param {string}   endDate   - YYYY-MM-DD
 * @returns {Promise<Array>} busy slots
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

    const freeBusy = await withTimeout(calendar.freebusy.query({
        requestBody: {
            timeMin,
            timeMax,
            items: [{ id: "primary" }],
        },
    }), 10000, "Google freebusy query");

    return freeBusy.data.calendars.primary.busy;
};


// getEvents


/**
 * Normalize a raw Google Calendar event into a simplified shape.
 * @param {Object} e - raw event from Google API
 * @returns {Object}
 */
const normalizeEvent = (e) => ({
    id: e.id,
    summary: e.summary || "Busy",
    start: e.start?.dateTime || e.start?.date,
    end: e.end?.dateTime || e.end?.date,
    allDay: !e.start?.dateTime,
});

/**
 * Fetch events from a single calendar. Returns empty array if the
 * calendar is unreadable (e.g. insufficient permissions).
 * Sonar fix: empty catch blocks replaced with explicit error logging.
 *
 * @param {Object} calendar  - Google Calendar API client
 * @param {string} calId     - calendar ID
 * @param {string} timeMin
 * @param {string} timeMax
 * @returns {Promise<Array>}
 */
const fetchEventsFromCalendar = async ({calendar, calId, timeMin, timeMax}) => {
    try {
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
        // log the skipped calendar instead of silently swallowing
        logger.warn(`⚠️ Could not read calendar ${calId} — skipping. Reason: ${err.message}`);
        return [];
    }
};

/**
 * Deduplicate events by id.
 * @param {Array} events
 * @returns {Array}
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
 * Fetch events from all accessible calendars and return deduplicated list.
 * @param {ObjectId} mentorId
 * @param {string}   startDate - YYYY-MM-DD
 * @param {string}   endDate   - YYYY-MM-DD
 * @returns {Promise<Array>}
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

    // Get all calendar IDs the user has access to
    const calList = await calendar.calendarList.list();
    const calendarIds = calList.data.items
        .filter((c) => c.selected !== false)
        .map((c) => c.id);

    // Fetch from all calendars in parallel
    const eventArrays = await Promise.all(
        calendarIds.map((calId) => withTimeout(fetchEventsFromCalendar({calendar, calId, timeMin, timeMax}), 10000, `Google events.list for calendar ${calId}`))
    );

    return deduplicateEvents(eventArrays.flat());
};

    return { getAuthUrl, handleCallback, disconnect, getBusySlots, getEvents, getStatus };
};
module.exports = createGoogleCalendarService;