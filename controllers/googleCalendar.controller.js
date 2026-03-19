// controllers/googleCalendar.controller.js
const { google } = require("googleapis");
const Availability = require("../models/Availability");

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI // e.g. http://localhost:5000/api/google-calendar/callback
);

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

// ─────────────────────────────────────────────────────────────
// GET /api/google-calendar/auth-url
// ─────────────────────────────────────────────────────────────
const getAuthUrl = async (req, res) => {
  try {
    const state = Buffer.from(JSON.stringify({ userId: req.user._id })).toString("base64");

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
      state,
    });

    return res.json({ url });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/google-calendar/callback  (no auth — Google redirects here)
// ─────────────────────────────────────────────────────────────
const handleCallback = async (req, res) => {
  try {
    const { code, state, error } = req.query;

    // Google denied access
    if (error) {
      console.error("❌ Google OAuth denied:", error);
      return res.send(`
        <script>
          window.opener?.postMessage({ type: "GOOGLE_CALENDAR_ERROR", error: "${error}" }, "*");
          window.close();
        </script>
      `);
    }

    const { userId } = JSON.parse(Buffer.from(state, "base64").toString());
    console.log("✅ Google callback received for userId:", userId);

    const { tokens } = await oauth2Client.getToken(code);
    console.log("✅ Tokens received:", Object.keys(tokens));

    const tokenJson = JSON.stringify(tokens);

    await Availability.findOneAndUpdate(
      { mentor: userId },
      { googleCalendarConnected: true, googleCalendarToken: tokenJson },
      { upsert: true }
    );

    console.log("✅ Google Calendar connected for userId:", userId);

    return res.send(`
      <script>
        window.opener?.postMessage({ type: "GOOGLE_CALENDAR_CONNECTED" }, "*");
        window.close();
      </script>
    `);
  } catch (err) {
    console.error("❌ Google Calendar callback error:", err.message, err?.response?.data);
    const safeError = encodeURIComponent(err.message);
    return res.send(`
      <script>
        window.opener?.postMessage({ type: "GOOGLE_CALENDAR_ERROR", error: decodeURIComponent("${safeError}") }, "*");
        window.close();
      </script>
    `);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/google-calendar/disconnect
// ─────────────────────────────────────────────────────────────
const disconnect = async (req, res) => {
  try {
    await Availability.findOneAndUpdate(
      { mentor: req.user._id },
      { googleCalendarConnected: false, googleCalendarToken: "" }
    );
    return res.json({ message: "Google Calendar disconnected" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/google-calendar/busy?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────
const getBusySlots = async (req, res) => {
  try {
    console.log("📅 getBusySlots called for user:", req.user._id);
    console.log("📅 Query params:", req.query);

    const avail = await Availability.findOne({ mentor: req.user._id }).select(
      "+googleCalendarToken"
    );

    if (!avail) {
      console.log("📅 No availability found for user");
      return res.json({ busy: [] });
    }

    if (!avail.googleCalendarToken) {
      console.log("📅 No Google Calendar token found");
      return res.json({ busy: [] });
    }

    const tokens = JSON.parse(avail.googleCalendarToken);
    console.log("📅 Token keys:", Object.keys(tokens));

    const freshClient = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    freshClient.setCredentials(tokens);

    // Auto-refresh token if expired
    freshClient.on("tokens", async (newTokens) => {
      console.log("📅 Token refreshed");
      const merged = { ...tokens, ...newTokens };
      await Availability.findOneAndUpdate(
        { mentor: req.user._id },
        { googleCalendarToken: JSON.stringify(merged) }
      );
    });

    const calendar = google.calendar({ version: "v3", auth: freshClient });
    const timeMin = new Date(req.query.startDate + "T00:00:00Z").toISOString();
    const timeMax = new Date(req.query.endDate + "T23:59:59Z").toISOString();

    console.log("📅 Fetching freebusy:", timeMin, "→", timeMax);

    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: "primary" }],
      },
    });

    const busy = freeBusy.data.calendars.primary.busy;
    console.log("📅 Busy slots found:", busy.length);
    return res.json({ busy });
  } catch (err) {
    console.error("❌ getBusySlots error:", err.message);
    console.error("❌ Full error:", err?.response?.data || err);
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/google-calendar/events?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────
const getEvents = async (req, res) => {
  try {
    const avail = await Availability.findOne({ mentor: req.user._id }).select(
      "+googleCalendarToken"
    );
    if (!avail?.googleCalendarToken) return res.json({ events: [] });

    const tokens = JSON.parse(avail.googleCalendarToken);
    const freshClient = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    freshClient.setCredentials(tokens);

    freshClient.on("tokens", async (newTokens) => {
      const merged = { ...tokens, ...newTokens };
      await Availability.findOneAndUpdate(
        { mentor: req.user._id },
        { googleCalendarToken: JSON.stringify(merged) }
      );
    });

    const calendar = google.calendar({ version: "v3", auth: freshClient });
    const timeMin  = new Date(req.query.startDate + "T00:00:00Z").toISOString();
    const timeMax  = new Date(req.query.endDate   + "T23:59:59Z").toISOString();

    // Get all calendar IDs the user has access to
    const calList = await calendar.calendarList.list();
    const calendarIds = calList.data.items
      .filter((c) => c.selected !== false)
      .map((c) => c.id);

    // Fetch events from all calendars and merge
    const allEvents = [];
    for (const calId of calendarIds) {
      try {
        const response = await calendar.events.list({
          calendarId:   calId,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy:      "startTime",
          maxResults:   250,
        });
        const items = (response.data.items || []).map((e) => ({
          id:      e.id,
          summary: e.summary || "Busy",
          start:   e.start?.dateTime || e.start?.date,
          end:     e.end?.dateTime   || e.end?.date,
          allDay:  !e.start?.dateTime,
        }));
        allEvents.push(...items);
      } catch (e) {
        // Skip calendars we can't read
      }
    }

    // Deduplicate by id
    const seen = new Set();
    const events = allEvents.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    return res.json({ events });
  } catch (err) {
    console.error("❌ getEvents error:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { getAuthUrl, handleCallback, disconnect, getBusySlots, getEvents };