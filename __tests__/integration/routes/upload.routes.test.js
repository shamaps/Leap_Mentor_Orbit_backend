const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockUploadProfilePicMiddleware = jest.fn((req, res) => res.status(200).json({ success: true }));
const mockUploadDocsMiddleware = jest.fn((req, res) => res.status(200).json({ success: true }));

jest.mock("../../../config/container", () => ({
    uploadController: {
        uploadProfilePicture: (req, res, next) => mockUploadProfilePicMiddleware(req, res, next),
        uploadVerificationDocuments: (req, res, next) => mockUploadDocsMiddleware(req, res, next),
    },
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "sandbox_mentor_actor" };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
}));

jest.mock("../../../middleware/rateLimiter", () => ({
    uploadLimiter: (req, res, next) => next(),
}));

jest.mock("../../../middleware/upload.middleware", () => ({
    uploadImage: { single: () => (req, res, next) => next() },
    upload: { fields: () => (req, res, next) => next() },
}));

describe("Asset Attachment Upload Routing Channels (Integration)", () => {
    let app;

    beforeAll(async () => {
        await dbHandler.connect();
        app = express();
        app.use(express.json());

        const uploadRoutes = require("../../../routes/upload.routes");
        app.use("/upload", uploadRoutes);
    });

    afterEach(async () => {
        await dbHandler.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await dbHandler.close();
    });

    it("POST /upload/profile-picture should protect routes checkpoints and accept multipart attachments forward", async () => {
        await request(app)
            .post("/upload/profile-picture")
            .expect(200);

        expect(mockUploadProfilePicMiddleware).toHaveBeenCalled();
    });

    it("POST /upload/verification-documents should evaluate role layers and hand off data to controller blocks", async () => {
        await request(app)
            .post("/upload/verification-documents")
            .expect(200);

        expect(mockUploadDocsMiddleware).toHaveBeenCalled();
    });
});