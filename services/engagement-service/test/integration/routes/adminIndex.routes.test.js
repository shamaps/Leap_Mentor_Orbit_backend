/**
 * @fileoverview Tests for the admin router index (src/routes/admin/index.js).
 * It only decides which admin router answers which path, so the three routers are stand-ins.
 */

const mockStubRouter = (name) => {
    const express = require("express");
    const router = express.Router();
    router.get("/ping", (req, res) => res.json({ router: name }));
    return router;
};

jest.mock("../../../src/routes/adminReports.routes", () => mockStubRouter("reports"));
jest.mock("../../../src/routes/adminLeapRequests.routes", () => mockStubRouter("leap-requests"));
jest.mock("../../../src/routes/adminEngagements.routes", () => mockStubRouter("engagements"));

const request = require("supertest");
const express = require("express");
const adminRoutes = require("../../../src/routes/admin");

const app = express();
app.use("/admin", adminRoutes);

describe("Admin router index", () => {
    it.each([
        ["/admin/reports/ping", "reports"],
        ["/admin/leap-requests/ping", "leap-requests"],
        ["/admin/engagements/ping", "engagements"],
    ])("sends %s to the %s router", async (url, expected) => {
        const res = await request(app).get(url).expect(200);
        expect(res.body.router).toBe(expected);
    });

    it("does not answer paths that no admin router owns", async () => {
        await request(app).get("/admin/ping").expect(404);
        await request(app).get("/admin/users/ping").expect(404);
    });
});
