const request = require("supertest");
const express = require("express");

// Each sub-router answers GET /ping with its own name, so we can see which one handled the request.
jest.mock("../../../src/routes/adminSettings.routes", () => {
    const router = require("express").Router();
    router.get("/ping", (req, res) => res.json({ router: "adminSettings" }));
    router.get("/settings-only", (req, res) => res.json({ router: "adminSettings" }));
    return router;
});

jest.mock("../../../src/routes/admin.routes", () => {
    const router = require("express").Router();
    router.get("/ping", (req, res) => res.json({ router: "admin" }));
    router.get("/users", (req, res) => res.json({ router: "admin", path: "/users" }));
    return router;
});

const adminIndex = require("../../../src/routes/admin");

describe("Admin Routes Index (Unit)", () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use("/admin", adminIndex);
    });

    it("should export an express router", () => {
        expect(typeof adminIndex).toBe("function");
        expect(Array.isArray(adminIndex.stack)).toBe(true);
    });

    it("should send /settings/* requests to the admin settings routes", async () => {
        const res = await request(app).get("/admin/settings/ping").expect(200);

        expect(res.body).toEqual({ router: "adminSettings" });
    });

    it("should send every other admin request to the main admin routes", async () => {
        const res = await request(app).get("/admin/users").expect(200);

        expect(res.body).toEqual({ router: "admin", path: "/users" });
    });

    it("should not let the main admin routes shadow /settings (settings is mounted first)", async () => {
        const settings = await request(app).get("/admin/settings/ping").expect(200);
        const main = await request(app).get("/admin/ping").expect(200);

        expect(settings.body.router).toBe("adminSettings");
        expect(main.body.router).toBe("admin");
    });

    it("should not expose settings-only routes outside the /settings prefix", async () => {
        await request(app).get("/admin/settings-only").expect(404);
    });

    it("should return 404 for paths neither router handles", async () => {
        await request(app).get("/admin/does-not-exist").expect(404);
        await request(app).get("/admin/settings/does-not-exist").expect(404);
    });
});
