const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockGetNotesMiddleware = jest.fn((req, res) => res.status(200).json({ success: true, notes: [] }));
const mockUploadNoteMiddleware = jest.fn((req, res) => res.status(201).json({ success: true, message: "Uploaded" }));

jest.mock("../../../config/container", () => ({
    noteController: {
        getNotes: (req, res, next) => mockGetNotesMiddleware(req, res, next),
        uploadNote: (req, res, next) => mockUploadNoteMiddleware(req, res, next),
        getPrivateNotes: jest.fn(),
        deleteNote: jest.fn(),
    },
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "sandbox_actor_user" };
        next();
    }),
}));

// Mock standard storage middleware behavior
jest.mock("../../../middleware/upload.middleware", () => ({
    upload: {
        single: () => (req, res, next) => {
            req.file = { originalname: "test_attachment.pdf" };
            next();
        }
    },
    getFileType: jest.fn(() => "raw"),
}));

describe("Note Routing Pipeline (Integration)", () => {
    let app;

    beforeAll(async () => {
        await dbHandler.connect();
        app = PatternApp = express();
        app.use(express.json());

        const noteRoutes = require("../../../routes/note.routes");
        app.use("/notes", noteRoutes);
    });

    afterEach(async () => {
        await dbHandler.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await dbHandler.close();
    });

    it("POST /notes/upload should correctly parse token segments and pass operations downstream", async () => {
        await request(app)
            .post("/notes/upload")
            .field("connectRequestId", "665f1c2e4b1a2c001f8e9a44")
            .attach("file", Buffer.from("dummy binary asset stream"), "report.pdf")
            .expect(201);

        expect(mockUploadNoteMiddleware).toHaveBeenCalled();
    });

    it("GET /notes/:connectRequestId should pass security validation limits and retrieve files layout", async () => {
        await request(app)
            .get("/notes/665f1c2e4b1a2c001f8e9a44")
            .expect(200);

        expect(mockGetNotesMiddleware).toHaveBeenCalled();
    });
});