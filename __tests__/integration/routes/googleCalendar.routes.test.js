const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockGetAuthUrlMiddleware = jest.fn((req, res) => res.status(200).json({ success: true, data: { url: "https://google.com" } }));

jest.mock("../../../config/container", () => ({
    googleCalendarController: {
        getAuthUrl: (req, res, next) => mockGetAuthUrlMiddleware(req, res, next),
        handleCallback: jest.fn(),
        disconnect: jest.fn(),
        getBusySlots: jest.fn(),
        getEvents: jest.fn(),
        getStatus: jest.fn(),
    },
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "user_ctx_id" };
        next();
    }),
}));

describe("Google Calendar Routing Channels (Integration)", () => {
    let app;

    beforeAll(async () => {
        await dbHandler.connect();
        app = express();
        app.use(express.json());

        const googleCalendarRoutes = require("../../../routes/googleCalendar.routes");
        app.use("/google-calendar", googleCalendarRoutes);
    });

    afterEach(async () => {
        await dbHandler.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await dbHandler.close();
    });

    it("GET /google-calendar/auth-url should parse credentials contexts and route requests safely", async () => {
        await request(app)
            .get("/google-calendar/auth-url")
            .expect(200);

        expect(mockGetAuthUrlMiddleware).toHaveBeenCalled();
    });
});