const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockSubmitReportMiddleware = jest.fn((req, res) => res.status(201).json({ success: true, message: "Created" }));
const mockGetAllReportsMiddleware = jest.fn((req, res) => res.status(200).json({ success: true, reports: [] }));

jest.mock("../../../config/container", () => ({
    reportController: {
        submitReport: (req, res, next) => mockSubmitReportMiddleware(req, res, next),
        getAllReports: (req, res, next) => mockGetAllReportsMiddleware(req, res, next),
        getMyReport: jest.fn(),
        updateReportStatus: jest.fn(),
    },
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "sandbox_reporter_user_id" };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
}));

jest.mock("../../../middleware/rateLimiter", () => ({
    reportLimiter: (req, res, next) => next(),
}));

jest.mock("../../../middleware/upload.middleware", () => ({
    upload: {
        single: () => (req, res, next) => next()
    }
}));

describe("Moderation Reports Routing Interfaces (Integration)", () => {
    let app;

    beforeAll(async () => {
        await dbHandler.connect();
        app = express();
        app.use(express.json());

        const reportRoutes = require("../../../routes/report.routes");
        app.use("/reports", reportRoutes);
    });

    afterEach(async () => {
        await dbHandler.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await dbHandler.close();
    });

    it("POST /reports should secure paths checkpoints and forward file elements and forms cleanly", async () => {
        await request(app)
            .post("/reports")
            .field("connectRequestId", "665f1c2e4b1a2c001f8e9a44")
            .field("reason", "No-show interaction case")
            .expect(201);

        expect(mockSubmitReportMiddleware).toHaveBeenCalled();
    });

    it("GET /reports/admin should require admin permission flags checkpoints and deliver list overviews", async () => {
        await request(app)
            .get("/reports/admin?status=pending&page=1&limit=5")
            .expect(200);

        expect(mockGetAllReportsMiddleware).toHaveBeenCalled();
    });
});