/**
 * @fileoverview Verifies the Payments admin router mounts the payments routes under /payments.
 */

const request = require("supertest");
const express = require("express");

jest.mock("../../../src/routes/adminPayments.routes", () => {
    const router = require("express").Router();
    router.get("/probe", (req, res) => res.json({ mounted: "adminPayments" }));
    return router;
});

const adminRouter = require("../../../src/routes/admin");

const app = express();
app.use("/admin", adminRouter);

describe("Payments admin router index (Integration)", () => {
    it("should mount the admin payments routes under /payments", async () => {
        const res = await request(app).get("/admin/payments/probe");

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ mounted: "adminPayments" });
    });

    it("should serve nothing outside /payments", async () => {
        const res = await request(app).get("/admin/users/probe");

        expect(res.status).toBe(404);
    });
});