const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockCreateNoteMiddleware = jest.fn((req, res) => res.status(201).json({ success: true, data: { note: {} } }));
const mockUpdateNoteMiddleware = jest.fn((req, res) => res.status(200).json({ success: true, data: { note: {} } }));

jest.mock("../../../config/container", () => ({
    privateNoteController: {
        createNote: (req, res, next) => mockCreateNoteMiddleware(req, res, next),
        updateNote: (req, res, next) => mockUpdateNoteMiddleware(req, res, next),
        getNotes: jest.fn(),
        deleteNote: jest.fn(),
    },
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "sandbox_author_actor_id" };
        next();
    }),
}));

describe("Private Note Routing Channels (Integration)", () => {
    let app;

    beforeAll(async () => {
        await dbHandler.connect();
        app = express();
        app.use(express.json());

        const privateNoteRoutes = require("../../../routes/privateNote.routes");
        app.use("/private-notes", privateNoteRoutes);
    });

    afterEach(async () => {
        await dbHandler.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await dbHandler.close();
    });

    it("POST /private-notes should forward payloads to controllers if schema inputs are valid", async () => {
        const hexObjectId = "665f1c2e4b1a2c001f8e9a44";

        await request(app)
            .post("/private-notes")
            .send({
                connectRequestId: hexObjectId,
                title: "Session notes roadmap outline",
                content: "Discuss microservices boundaries models structures.",
            })
            .expect(201);

        expect(mockCreateNoteMiddleware).toHaveBeenCalled();
    });

    it("PATCH /private-notes/:id should block mutations with a status 400 if delta payload updates are completely empty", async () => {
        await request(app)
            .patch("/private-notes/some_id_string")
            .send({}) // Violates min(1) constraint requirement rule
            .expect(400);

        expect(mockUpdateNoteMiddleware).not.toHaveBeenCalled();
    });
});