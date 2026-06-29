const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockGetSlots = jest.fn((req, res) => res.status(200).json({ success: true, slots: [] }));
const mockAddSlot = jest.fn((req, res) => res.status(201).json({ success: true, message: "Slot added" }));
const mockMarkSlotComplete = jest.fn((req, res) => res.status(200).json({ success: true, message: "Marked complete" }));
const mockCancelSlot = jest.fn((req, res) => res.status(200).json({ success: true, message: "Cancelled" }));
const mockRescheduleSlot = jest.fn((req, res) => res.status(200).json({ success: true, message: "Rescheduled" }));

jest.mock("../../../config/container", () => ({
    sessionController: {
        getSlots: (req, res, next) => mockGetSlots(req, res, next),
        addSlot: (req, res, next) => mockAddSlot(req, res, next),
        markSlotComplete: (req, res, next) => mockMarkSlotComplete(req, res, next),
        cancelSlot: (req, res, next) => mockCancelSlot(req, res, next),
        rescheduleSlot: (req, res, next) => mockRescheduleSlot(req, res, next),
        setMeetingLink: jest.fn(),
        getMentorAvailability: jest.fn(),
    },
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "sandbox_session_user_id" };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
}));

describe("Session Orchestration Routing Engine (Integration)", () => {
    let app;

    beforeAll(async () => {
        await dbHandler.connect();
        app = express();
        app.use(express.json());

        const sessionRoutes = require("../../../routes/session.routes");
        app.use("/sessions", sessionRoutes);
    });

    afterEach(async () => {
        await dbHandler.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await dbHandler.close();
    });

    it("GET /sessions/:connectRequestId/slots should route successfully to getSlots", async () => {
        await request(app)
            .get("/sessions/665f1c2e4b1a2c001f8e9a44/slots")
            .expect(200);

        expect(mockGetSlots).toHaveBeenCalled();
    });

    it("POST /sessions/:connectRequestId/slots should validate structural parameters before creating an additional slot", async () => {
        await request(app)
            .post("/sessions/665f1c2e4b1a2c001f8e9a44/slots")
            .send({ date: "2026-07-10", startTime: "14:00", endTime: "15:00" })
            .expect(201);

        expect(mockAddSlot).toHaveBeenCalled();
    });

    it("PATCH /sessions/:connectRequestId/slots/:slotIndex/status should parse action flags and route to markSlotComplete", async () => {
        await request(app)
            .patch("/sessions/665f1c2e4b1a2c001f8e9a44/slots/0/status")
            .send({ action: "complete" })
            .expect(200);

        expect(mockMarkSlotComplete).toHaveBeenCalled();
    });

    it("PATCH /sessions/:connectRequestId/slots/:slotIndex/status should parse action flags and route to cancelSlot", async () => {
        await request(app)
            .patch("/sessions/665f1c2e4b1a2c001f8e9a44/slots/0/status")
            .send({ action: "cancel", reason: "Mentor unavailable" })
            .expect(200);

        expect(mockCancelSlot).toHaveBeenCalled();
    });

    it("PATCH /sessions/:connectRequestId/slots/:slotIndex/status should fail Joi validations if reschedule parameters are missing", async () => {
        await request(app)
            .patch("/sessions/665f1c2e4b1a2c001f8e9a44/slots/0/status")
            .send({ action: "reschedule" }) // Missing mandatory date/startTime/endTime parameters
            .expect(400);

        expect(mockRescheduleSlot).not.toHaveBeenCalled();
    });
});