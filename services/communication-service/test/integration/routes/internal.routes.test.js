/**
 * @fileoverview Routing tests for the Communication internal API (real-time event push, called by Engagement).
 */

const request = require("supertest");
const express = require("express");

// The route reads emitToUser / io from this object on every request, so tests can swap them freely.
const mockSocketHandler = { emitToUser: null, io: null };
jest.mock("../../../src/socket/socketHandler", () => mockSocketHandler);

const internalRoutes = require("../../../src/routes/internal.routes");

const TOKEN = "engagement-to-communication-secret";
const USER_ID = "a".repeat(24);

const app = express();
app.use(express.json());
app.use("/internal", internalRoutes);

const asEngagement = (req) => req.set("x-caller-service", "engagement").set("x-internal-token", TOKEN);
const postEvent = (body) => asEngagement(request(app).post("/internal/events").send(body));

// Fresh Socket.IO stand-in: io.to(room) -> { emit, except }, where except() keeps chaining.
const makeIo = () => {
    const emit = jest.fn();
    const chain = { emit };
    chain.except = jest.fn(() => chain);
    const io = { to: jest.fn(() => chain) };
    return { io, chain, emit };
};

let previousToken;
beforeAll(() => {
    previousToken = process.env.ENGAGEMENT_TO_COMMUNICATION_TOKEN;
    process.env.ENGAGEMENT_TO_COMMUNICATION_TOKEN = TOKEN;
});
afterAll(() => {
    if (previousToken === undefined) delete process.env.ENGAGEMENT_TO_COMMUNICATION_TOKEN;
    else process.env.ENGAGEMENT_TO_COMMUNICATION_TOKEN = previousToken;
});
beforeEach(() => {
    mockSocketHandler.emitToUser = null;
    mockSocketHandler.io = null;
});

describe("Communication Internal Routes (Integration)", () => {
    describe("service-to-service authentication", () => {
        it("should reject a call with no credentials", async () => {
            const res = await request(app).post("/internal/events").send({ target: "user", userId: USER_ID, event: "ping" });

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should reject a caller that is not allowed", async () => {
            const res = await request(app)
                .post("/internal/events")
                .set("x-caller-service", "identity")
                .set("x-internal-token", TOKEN)
                .send({ target: "user", userId: USER_ID, event: "ping" });

            expect(res.status).toBe(401);
        });

        it("should reject a wrong token and never emit anything", async () => {
            mockSocketHandler.emitToUser = jest.fn();

            const res = await request(app)
                .post("/internal/events")
                .set("x-caller-service", "engagement")
                .set("x-internal-token", "wrong")
                .send({ target: "user", userId: USER_ID, event: "ping" });

            expect(res.status).toBe(401);
            expect(mockSocketHandler.emitToUser).not.toHaveBeenCalled();
        });

        it("should answer 503 when the shared secret is not configured", async () => {
            delete process.env.ENGAGEMENT_TO_COMMUNICATION_TOKEN;
            try {
                const res = await postEvent({ target: "user", userId: USER_ID, event: "ping" });
                expect(res.status).toBe(503);
            } finally {
                process.env.ENGAGEMENT_TO_COMMUNICATION_TOKEN = TOKEN;
            }
        });
    });

    describe("POST /events - event name validation", () => {
        it.each([
            ["missing", undefined],
            ["a number", 42],
            ["empty", ""],
            ["too long (65 chars)", "a".repeat(65)],
            ["containing a space", "bad name"],
            ["containing a slash", "bad/name"],
            ["containing an exclamation mark", "bad!"],
        ])("should reject an event name that is %s", async (_label, event) => {
            const res = await postEvent({ target: "user", userId: USER_ID, event });

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ success: false, message: "Invalid event name" });
        });

        it.each(["new_message", "request:accepted", "session.updated", "a-b", "a".repeat(64)])(
            "should accept the event name %s",
            async (event) => {
                mockSocketHandler.emitToUser = jest.fn(() => true);

                const res = await postEvent({ target: "user", userId: USER_ID, event });

                expect(res.status).toBe(202);
            }
        );

        it("should reject an empty body", async () => {
            const res = await asEngagement(request(app).post("/internal/events").send({}));

            expect(res.status).toBe(400);
            expect(res.body.message).toBe("Invalid event name");
        });
    });

    describe("POST /events - target user", () => {
        it("should deliver to the user and report delivered when a socket received it", async () => {
            mockSocketHandler.emitToUser = jest.fn(() => true);

            const res = await postEvent({ target: "user", userId: USER_ID, event: "new_message", data: { text: "hi" } });

            expect(res.status).toBe(202);
            expect(res.body).toEqual({ success: true, delivered: true });
            expect(mockSocketHandler.emitToUser).toHaveBeenCalledWith(USER_ID, "new_message", { text: "hi" });
        });

        it("should report delivered false when the user has no connected socket", async () => {
            mockSocketHandler.emitToUser = jest.fn(() => false);

            const res = await postEvent({ target: "user", userId: USER_ID, event: "new_message" });

            expect(res.status).toBe(202);
            expect(res.body).toEqual({ success: true, delivered: false });
        });

        it("should report delivered false when the socket server has not started yet", async () => {
            const res = await postEvent({ target: "user", userId: USER_ID, event: "new_message" });

            expect(res.status).toBe(202);
            expect(res.body).toEqual({ success: true, delivered: false });
        });

        it.each([
            ["missing", undefined],
            ["empty", ""],
            ["not a string", 123],
            ["an object", { $ne: null }],
        ])("should reject a userId that is %s", async (_label, userId) => {
            mockSocketHandler.emitToUser = jest.fn();

            const res = await postEvent({ target: "user", userId, event: "new_message" });

            expect(res.status).toBe(400);
            expect(res.body.message).toBe("userId is required");
            expect(mockSocketHandler.emitToUser).not.toHaveBeenCalled();
        });
    });

    describe("POST /events - target room", () => {
        it("should emit to everyone in the room", async () => {
            const { io, chain, emit } = makeIo();
            mockSocketHandler.io = io;

            const res = await postEvent({ target: "room", room: "request-1", event: "new_message", data: { n: 1 } });

            expect(res.status).toBe(202);
            expect(res.body).toEqual({ success: true, delivered: true });
            expect(io.to).toHaveBeenCalledWith("request-1");
            expect(chain.except).not.toHaveBeenCalled();
            expect(emit).toHaveBeenCalledWith("new_message", { n: 1 });
        });

        it("should skip excluded socket ids and ignore non-string entries", async () => {
            const { io, chain, emit } = makeIo();
            mockSocketHandler.io = io;

            await postEvent({ target: "room", room: "request-1", event: "typing", exclude: ["s1", 7, null, "s2"] });

            expect(chain.except).toHaveBeenCalledWith(["s1", "s2"]);
            expect(emit).toHaveBeenCalledTimes(1);
        });

        it("should not call except when the exclude list is empty or not an array", async () => {
            const { io, chain } = makeIo();
            mockSocketHandler.io = io;

            await postEvent({ target: "room", room: "request-1", event: "typing", exclude: [] });
            await postEvent({ target: "room", room: "request-1", event: "typing", exclude: "s1" });
            await postEvent({ target: "room", room: "request-1", event: "typing", exclude: [1, 2] });

            expect(chain.except).not.toHaveBeenCalled();
        });

        it("should report delivered false when the socket server has not started yet", async () => {
            const res = await postEvent({ target: "room", room: "request-1", event: "new_message" });

            expect(res.status).toBe(202);
            expect(res.body).toEqual({ success: true, delivered: false });
        });

        it.each([
            ["missing", undefined],
            ["empty", ""],
            ["not a string", 5],
        ])("should reject a room that is %s", async (_label, room) => {
            const { io, emit } = makeIo();
            mockSocketHandler.io = io;

            const res = await postEvent({ target: "room", room, event: "new_message" });

            expect(res.status).toBe(400);
            expect(res.body.message).toBe("room is required");
            expect(emit).not.toHaveBeenCalled();
        });
    });

    describe("POST /events - target validation", () => {
        it.each([undefined, "all", "USER", "broadcast"])("should reject the target %s", async (target) => {
            const res = await postEvent({ target, event: "new_message" });

            expect(res.status).toBe(400);
            expect(res.body.message).toBe('target must be "user" or "room"');
        });
    });

    it("should not expose other paths or methods", async () => {
        const get = await asEngagement(request(app).get("/internal/events"));
        const other = await asEngagement(request(app).post("/internal/unknown").send({}));

        expect(get.status).toBe(404);
        expect(other.status).toBe(404);
    });
});