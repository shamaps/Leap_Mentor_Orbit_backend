/**
 * @fileoverview Verifies the Catalog admin router mounts the mentor-verification routes.
 */

const request = require("supertest");
const express = require("express");

jest.mock("../../../src/routes/adminVerification.routes", () => {
    const router = require("express").Router();
    router.get("/probe", (req, res) => res.json({ mounted: "adminVerification" }));
    return router;
});

const adminRouter = require("../../../src/routes/admin");

const app = express();
app.use("/admin", adminRouter);

describe("Catalog admin router index (Integration)", () => {
    it("should mount the verification routes under /mentor-verifications", async () => {
        const res = await request(app).get("/admin/mentor-verifications/probe");

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ mounted: "adminVerification" });
    });

    it("should serve nothing at the router root or under other prefixes", async () => {
        expect((await request(app).get("/admin/probe")).status).toBe(404);
        expect((await request(app).get("/admin/users/probe")).status).toBe(404);
    });
});
