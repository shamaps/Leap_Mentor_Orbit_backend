const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockLockSlotMiddleware = jest.fn((req, res) => res.status(200).json({ success: true, message: "Locked" }));
const mockUnlockSlotMiddleware = jest.fn((req, res) => res.status(200).json({ success: true, message: "Unlocked" }));

jest.mock("../../../config/container", () => ({
    slotLockController: {
        lockSlot: (req, res, next) => mockLockSlotMiddleware(req, res, next),
        unlockSlot: (req, res, next) => mockUnlockSlotMiddleware(req, res, next),
        unlockAllByMentee: jest.fn(),
        getActiveLocks: jest.fn(),
    },
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "sandbox_mentee_actor" };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
}));

describe("Slot Locking Routing Ecosystem (Integration)", () => {
    let app;

    beforeAll(async () => {
        await dbHandler.connect();
        app = express();
        app.use(express.json());

        const slotLockRoutes = require("../../../routes/slotLock.routes");
        app.use("/slot-locks", slotLockRoutes);
    });

    afterEach(async () => {
        await dbHandler.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await dbHandler.close();
    });

    it("POST /slot-locks/lock should pass valid schematic formatting constraints onto subsequent processing streams", async () => {
        await request(app)
            .post("/slot-locks/lock")
            .send({
                mentorId: "665f1c2e4b1a2c001f8e9a22",
                date: "2026-07-06",
                startTime: "09:00",
                endTime: "10:00",
            })
            .expect(200);

        expect(mockLockSlotMiddleware).toHaveBeenCalled();
    });

    it("POST /slot-locks/lock should intercept requests with status 400 if formatting constraints fail", async () => {
        await request(app)
            .post("/slot-locks/lock")
            .send({
                mentorId: "short-bad-id", // breaking regex length limitations constraints
                date: "06-07-2026",       // breaking YYYY-MM-DD pattern limits
            })
            .expect(400);

        expect(mockLockSlotMiddleware).not.toHaveBeenCalled();
    });
});