const express = require("express");
const request = require("supertest");

jest.mock("../../utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const AppError = require("../../utils/appError");
const { createUserLifecycleRouter } = require("../../utils/userLifecycleRouter");

const ENV = "IDENTITY_TO_PAYMENTS_TOKEN";
const SECRET = "identity-secret";
const VALID_ID = "64b7f0c2a1b2c3d4e5f60718";
const auth = { "X-Caller-Service": "identity", "X-Internal-Token": SECRET };

beforeEach(() => { process.env[ENV] = SECRET; });
afterEach(() => { delete process.env[ENV]; });

const makeApp = (handlers) => {
    const app = express();
    app.use("/internal/users", createUserLifecycleRouter({ service: "payments", handlers }));
    return app;
};
const allHandlers = () => ({
    hardDelete: jest.fn().mockResolvedValue({ deleted: 3 }),
    softDelete: jest.fn().mockResolvedValue({ frozen: true }),
    restore: jest.fn().mockResolvedValue({ restored: true }),
});

describe("authentication (only the identity service may call)", () => {
    test.each([
        ["DELETE", "delete", `/internal/users/${VALID_ID}`],
        ["soft-delete", "post", `/internal/users/${VALID_ID}/soft-delete`],
        ["restore", "post", `/internal/users/${VALID_ID}/restore`],
    ])("%s rejects an unauthenticated call and never runs the handler", async (_n, method, path) => {
        const handlers = allHandlers();
        const res = await request(makeApp(handlers))[method](path);
        expect(res.status).toBe(401);
        expect(Object.values(handlers).every((h) => h.mock.calls.length === 0)).toBe(true);
    });

    test("rejects another internal service even with a valid-looking token", async () => {
        const res = await request(makeApp(allHandlers()))
            .delete(`/internal/users/${VALID_ID}`)
            .set({ "X-Caller-Service": "engagement", "X-Internal-Token": SECRET });
        expect(res.status).toBe(401);
    });

    test("rejects a wrong token", async () => {
        const res = await request(makeApp(allHandlers()))
            .delete(`/internal/users/${VALID_ID}`)
            .set({ ...auth, "X-Internal-Token": "wrong" });
        expect(res.status).toBe(401);
    });

    test("503 when the service has no secret configured", async () => {
        delete process.env[ENV];
        const res = await request(makeApp(allHandlers())).delete(`/internal/users/${VALID_ID}`).set(auth);
        expect(res.status).toBe(503);
    });
});

describe("routes", () => {
    test("DELETE /:userId runs hardDelete and wraps the result", async () => {
        const handlers = allHandlers();
        const res = await request(makeApp(handlers)).delete(`/internal/users/${VALID_ID}`).set(auth);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true, data: { deleted: 3 } });
        expect(handlers.hardDelete).toHaveBeenCalledWith(VALID_ID);
        expect(handlers.softDelete).not.toHaveBeenCalled();
    });

    test("POST /:userId/soft-delete runs softDelete", async () => {
        const handlers = allHandlers();
        const res = await request(makeApp(handlers)).post(`/internal/users/${VALID_ID}/soft-delete`).set(auth);
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ frozen: true });
        expect(handlers.softDelete).toHaveBeenCalledWith(VALID_ID);
    });

    test("POST /:userId/restore runs restore", async () => {
        const handlers = allHandlers();
        const res = await request(makeApp(handlers)).post(`/internal/users/${VALID_ID}/restore`).set(auth);
        expect(res.status).toBe(200);
        expect(handlers.restore).toHaveBeenCalledWith(VALID_ID);
    });

    test("only registers routes for the handlers that were supplied", async () => {
        const app = makeApp({ softDelete: jest.fn().mockResolvedValue({}) });
        expect((await request(app).post(`/internal/users/${VALID_ID}/soft-delete`).set(auth)).status).toBe(200);
        expect((await request(app).delete(`/internal/users/${VALID_ID}`).set(auth)).status).toBe(404);
        expect((await request(app).post(`/internal/users/${VALID_ID}/restore`).set(auth)).status).toBe(404);
    });

    test.each([
        ["too short", "abc"],
        ["not hex", "zzzzzzzzzzzzzzzzzzzzzzzz"],
        ["too long", `${VALID_ID}00`],
        ["a NoSQL operator payload", "%7B%22%24ne%22%3Anull%7D"],
    ])("400 for an invalid userId (%s), without running the handler", async (_n, id) => {
        const handlers = allHandlers();
        const res = await request(makeApp(handlers)).delete(`/internal/users/${id}`).set(auth);
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ success: false, message: "userId must be a valid ID" });
        expect(handlers.hardDelete).not.toHaveBeenCalled();
    });

    test("accepts an upper-case hex id", async () => {
        const res = await request(makeApp(allHandlers())).delete(`/internal/users/${VALID_ID.toUpperCase()}`).set(auth);
        expect(res.status).toBe(200);
    });
});

describe("error handling", () => {
    test("an AppError from the handler keeps its status and message", async () => {
        const handlers = { hardDelete: jest.fn().mockRejectedValue(new AppError(409, "User has open escrows")) };
        const res = await request(makeApp(handlers)).delete(`/internal/users/${VALID_ID}`).set(auth);
        expect(res.status).toBe(409);
        expect(res.body).toEqual({ success: false, message: "User has open escrows" });
    });

    test("an unexpected error becomes a generic 500 with no internals", async () => {
        const handlers = { hardDelete: jest.fn().mockRejectedValue(new Error("E11000 mongodb://secret@host")) };
        const res = await request(makeApp(handlers)).delete(`/internal/users/${VALID_ID}`).set(auth);
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ success: false, message: "Internal server error" });
    });
});
