const express = require("express");
const request = require("supertest");

jest.mock("mongoose", () => ({ connection: { readyState: 1 } }));
jest.mock("../../utils/cache", () => ({
    redisClient: { status: "ready", ping: jest.fn(), connect: jest.fn() },
}));

const mongoose = require("mongoose");
const { redisClient } = require("../../utils/cache");
const { createHealthRouter } = require("../../utils/health");

const makeApp = (opts = { service: "identity" }) => {
    const app = express();
    app.use("/health", createHealthRouter(opts));
    return app;
};

beforeEach(() => {
    mongoose.connection.readyState = 1;
    redisClient.status = "ready";
    redisClient.ping.mockResolvedValue("PONG");
    redisClient.connect.mockResolvedValue(undefined);
});

describe("createHealthRouter", () => {
    test.each([[undefined], [{}]])("requires a service name (%j)", (opts) => {
        expect(() => createHealthRouter(opts)).toThrow(/'service' is required/);
    });

    describe("GET /health/live", () => {
        test("200 as long as the process is up, regardless of dependencies", async () => {
            mongoose.connection.readyState = 0;
            redisClient.ping.mockRejectedValue(new Error("down"));
            const res = await request(makeApp()).get("/health/live");
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ status: "ok", service: "identity" });
        });

        test("does not touch Redis", async () => {
            await request(makeApp()).get("/health/live");
            expect(redisClient.ping).not.toHaveBeenCalled();
        });
    });

    describe("GET /health/ready", () => {
        test("200 when MongoDB and Redis are both reachable", async () => {
            const res = await request(makeApp()).get("/health/ready");
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ status: "ready", service: "identity", checks: { mongo: true, redis: true } });
        });

        test.each([[0], [2], [3]])("503 when mongoose readyState is %i (not connected)", async (state) => {
            mongoose.connection.readyState = state;
            const res = await request(makeApp()).get("/health/ready");
            expect(res.status).toBe(503);
            expect(res.body).toMatchObject({ status: "not_ready", checks: { mongo: false, redis: true } });
        });

        test("503 when Redis ping rejects", async () => {
            redisClient.ping.mockRejectedValue(new Error("ECONNREFUSED"));
            const res = await request(makeApp()).get("/health/ready");
            expect(res.status).toBe(503);
            expect(res.body.checks).toEqual({ mongo: true, redis: false });
        });

        test("503 when Redis answers with something other than PONG", async () => {
            redisClient.ping.mockResolvedValue("LOADING");
            const res = await request(makeApp()).get("/health/ready");
            expect(res.status).toBe(503);
            expect(res.body.checks.redis).toBe(false);
        });

        test("a lazily-connected Redis client (status 'wait') is connected before pinging", async () => {
            redisClient.status = "wait";
            const res = await request(makeApp()).get("/health/ready");
            expect(redisClient.connect).toHaveBeenCalledTimes(1);
            expect(res.status).toBe(200);
        });

        test("if connecting a lazy Redis client fails, Redis is reported down", async () => {
            redisClient.status = "wait";
            redisClient.connect.mockRejectedValue(new Error("refused"));
            const res = await request(makeApp()).get("/health/ready");
            expect(res.status).toBe(503);
            expect(res.body.checks.redis).toBe(false);
        });

        test("a Redis client that is already connected is not reconnected", async () => {
            await request(makeApp()).get("/health/ready");
            expect(redisClient.connect).not.toHaveBeenCalled();
        });

        describe("extraChecks", () => {
            test("are reported alongside mongo and redis", async () => {
                const res = await request(makeApp({
                    service: "payments",
                    extraChecks: { stripe: () => true, queue: async () => true },
                })).get("/health/ready");
                expect(res.status).toBe(200);
                expect(res.body.checks).toEqual({ mongo: true, redis: true, stripe: true, queue: true });
            });

            test("a failing extra check makes the service not ready", async () => {
                const res = await request(makeApp({ service: "payments", extraChecks: { stripe: () => false } })).get("/health/ready");
                expect(res.status).toBe(503);
                expect(res.body.checks.stripe).toBe(false);
            });

            test("a throwing or rejecting extra check counts as failed instead of crashing the probe", async () => {
                const res = await request(makeApp({
                    service: "payments",
                    extraChecks: { a: () => { throw new Error("x"); }, b: async () => { throw new Error("y"); } },
                })).get("/health/ready");
                expect(res.status).toBe(503);
                expect(res.body.checks).toMatchObject({ a: false, b: false });
            });

            test("truthy/falsy results are coerced to booleans", async () => {
                const res = await request(makeApp({
                    service: "payments", extraChecks: { yes: () => "ok", no: () => 0 },
                })).get("/health/ready");
                expect(res.body.checks).toMatchObject({ yes: true, no: false });
            });
        });
    });
});
