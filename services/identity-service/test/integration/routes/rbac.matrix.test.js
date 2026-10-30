const request = require("supertest");
const express = require("express");

const mockOk = (req, res) => res.status(200).json({ success: true });
const mockController = new Proxy({}, { get: () => mockOk });

jest.mock("../../../src/config/container", () => ({
    adminController: mockController,
    adminSettingsController: mockController,
}));

jest.mock("@leapmentor/shared/middleware/authenticate", () => {
    const actual = jest.requireActual("@leapmentor/shared/middleware/authenticate");
    return {
        ...actual,
        authenticate: (req, res, next) => {
            const role = req.headers["x-user-role"];
            if (!role) return res.status(401).json({ message: "No token" });
            req.user = { _id: `user-${role}`, roles: [role] };
            return next();
        },
    };
});

jest.mock("@leapmentor/shared/middleware/adminAuth", () => {
    const actual = jest.requireActual("@leapmentor/shared/middleware/adminAuth");
    return {
        ...actual,
        adminAuthenticate: (req, res, next) => {
            const role = req.headers["x-admin-role"];
            if (!role) return res.status(401).json({ message: "No admin token" });
            req.admin = { _id: `admin-${role}`, isSuperAdmin: role === "super" };
            return next();
        },
    };
});

jest.mock("@leapmentor/shared/middleware/validate", () => () => (req, res, next) => next());
jest.mock("@leapmentor/shared/middleware/rateLimiter", () => ({ adminLoginLimiter: (req, res, next) => next() }));
jest.mock("@leapmentor/shared/middleware/noteAccess", () => {
    const next = (req, res, callback) => callback();
    return {
        validateSessionMembership: next,
        allowAcceptedSession: next,
        resolveSessionFromResource: next,
        validateNoteOwnership: next,
        requirePrivateOwnership: next,
    };
});

const app = express();
app.use(express.json());
app.use("/admin", require("../../../src/routes/admin.routes"));
app.use("/admin/settings", require("../../../src/routes/adminSettings.routes"));

const adminActors = [
    { name: "anonymous", userRole: null, adminRole: null, expected: 401 },
    { name: "mentee", userRole: "mentee", adminRole: null, expected: 401 },
    { name: "mentor", userRole: "mentor", adminRole: null, expected: 401 },
    { name: "normal admin", userRole: null, adminRole: "normal", expected: 403 },
    { name: "super admin", userRole: null, adminRole: "super", expected: 200 },
];




describe("Identity RBAC route matrix", () => {
    it.each([
        { name: "add admin", method: "post", path: "/admin/settings/admins", data: { name: "New Admin", email: "new@example.com" } },
        { name: "change commission", method: "patch", path: "/admin/settings/commission", data: { commissionRate: 10 } },
        { name: "delete user", method: "delete", path: "/admin/users/user-1" },
    ])("$name requires super-admin", async (route) => {
        for (const actor of adminActors) {
            let call = request(app)[route.method](route.path);
            if (actor.userRole) call = call.set("x-user-role", actor.userRole);
            if (actor.adminRole) call = call.set("x-admin-role", actor.adminRole);
            if (route.data) call = call.send(route.data);
            await call.expect(actor.expected);
        }
    });

    it("allows normal and super admins to use ordinary admin settings", async () => {
        await request(app).get("/admin/settings/overview").set("x-admin-role", "normal").expect(200);
        await request(app).get("/admin/settings/overview").set("x-admin-role", "super").expect(200);
    });
});
