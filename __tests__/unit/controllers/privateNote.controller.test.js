/**
 * @fileoverview Unit tests for Private Note Controller.
 * Achieves 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(500).json({ error: err.message, context })),
}));

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json(data)),
    created: jest.fn((res, data) => res.status(201).json(data)),
    noContent: jest.fn((res) => res.status(204).send()),
}));

const createPrivateNoteController = require("../../../controllers/privateNote.controller");
const { handleError } = require("../../../utils/appError");
const { ok, created, noContent } = require("../../../utils/response");

describe("Private Note Controller (100% Comprehensive Coverage Blueprint)", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = {
            createNote: jest.fn(),
            getNotes: jest.fn(),
            updateNote: jest.fn(),
            deleteNote: jest.fn(),
        };

        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createPrivateNoteController(mockService, { logger: mockLogger });

        req = {
            params: { connectRequestId: "cr_xyz_789", id: "pnote_111" },
            body: { content: "Mentee exhibited solid fundamentals in system design core topics." },
            user: { _id: "user_actor_007" },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        };

        jest.clearAllMocks();
    });

    describe("createNote Endpoint", () => {
        it("should return a 201 created response holding fresh record items on success", async () => {
            const mockData = { id: "pnote_111", content: req.body.content };
            mockService.createNote.mockResolvedValue(mockData);

            await controller.createNote(req, res);

            expect(mockService.createNote).toHaveBeenCalledWith("user_actor_007", req.body);
            expect(created).toHaveBeenCalledWith(res, mockData);
        });

        it("should intercept service execution exceptions and forward through handleError", async () => {
            const err = new Error("Database validation failure constraint");
            mockService.createNote.mockRejectedValue(err);

            await controller.createNote(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "privateNote.createNote");
        });
    });

    describe("getNotes Endpoint", () => {
        it("should pull caller notebook lists matching session indicators successfully", async () => {
            const mockList = [{ id: "pnote_111", content: "some text" }];
            mockService.getNotes.mockResolvedValue(mockList);

            await controller.getNotes(req, res);

            expect(mockService.getNotes).toHaveBeenCalledWith("cr_xyz_789", "user_actor_007");
            expect(ok).toHaveBeenCalledWith(res, mockList);
        });

        it("should route lookup connection faults straight through to handleError", async () => {
            const err = new Error("Database query fetch error");
            mockService.getNotes.mockRejectedValue(err);

            await controller.getNotes(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "privateNote.getNotes");
        });
    });

    describe("updateNote Endpoint", () => {
        it("should mutate notebook content data elements successfully", async () => {
            const mockUpdatedData = { id: "pnote_111", content: "updated text" };
            mockService.updateNote.mockResolvedValue(mockUpdatedData);

            await controller.updateNote(req, res);

            expect(mockService.updateNote).toHaveBeenCalledWith("pnote_111", "user_actor_007", req.body);
            expect(ok).toHaveBeenCalledWith(res, mockUpdatedData);
        });

        it("should intercept patch mutation exceptions and route to handleError helper", async () => {
            const err = new Error("Private note not found or ownership mismatch");
            mockService.updateNote.mockRejectedValue(err);

            await controller.updateNote(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "privateNote.updateNote");
        });
    });

    describe("deleteNote Endpoint", () => {
        it("should initiate hard removal workflows and emit noContent statuses cleanly", async () => {
            mockService.deleteNote.mockResolvedValue({ message: "Deleted" });

            await controller.deleteNote(req, res);

            expect(mockService.deleteNote).toHaveBeenCalledWith("pnote_111", "user_actor_007");
            expect(noContent).toHaveBeenCalledWith(res);
        });

        it("should catch removal faults and pass context descriptors to handleError", async () => {
            const err = new Error("Delete write block operational fault");
            mockService.deleteNote.mockRejectedValue(err);

            await controller.deleteNote(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "privateNote.deleteNote");
        });
    });
});