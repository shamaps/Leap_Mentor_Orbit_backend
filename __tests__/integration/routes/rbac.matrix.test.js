const request = require("supertest");
const express = require("express");

const mockOk = (req, res) => res.status(200).json({ success: true });
const mockController = new Proxy({}, { get: () => mockOk });

jest.mock("../../../config/container", () => ({
    connectRequestController: mockController,
    mentorReferController: mockController,
    earningsController: mockController,
    invoiceController: mockController,
    messageController: mockController,
    noteController: mockController,
    privateNoteController: mockController,
    goalController: mockController,
    feedbackController: mockController,
    sessionController: mockController,
    slotLockController: mockController,
    adminController: mockController,
    adminSettingsController: mockController,
    leapRequestController: mockController,
}));

jest.mock("../../../middleware/authenticate", () => {
    const actual = jest.requireActual("../../../middleware/authenticate");
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

jest.mock("../../../middleware/adminAuth", () => {
    const actual = jest.requireActual("../../../middleware/adminAuth");
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

jest.mock("../../../middleware/validate", () => () => (req, res, next) => next());
jest.mock("../../../middleware/rateLimiter", () => ({ adminLoginLimiter: (req, res, next) => next() }));
jest.mock("../../../middleware/noteAccess", () => {
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
app.use("/connect-requests", require("../../../routes/connectRequest.routes"));
app.use("/mentor/earnings", require("../../../routes/earnings.routes"));
app.use("/invoices", require("../../../routes/invoice.routes"));
app.use("/messages", require("../../../routes/message.routes"));
app.use("/notes", require("../../../routes/note.routes"));
app.use("/private-notes", require("../../../routes/privateNote.routes"));
app.use("/goals", require("../../../routes/goal.routes"));
app.use("/feedback", require("../../../routes/feedback.routes"));
app.use("/sessions", require("../../../routes/session.routes"));
app.use("/slot-locks", require("../../../routes/slotLock.routes"));
app.use("/admin", require("../../../routes/admin.routes"));
app.use("/admin/settings", require("../../../routes/adminSettings.routes"));

const userActors = [
    { name: "anonymous", userRole: null, expected: 401 },
    { name: "mentee", userRole: "mentee" },
    { name: "mentor", userRole: "mentor" },
    { name: "normal admin", userRole: "admin" },
    { name: "super admin", userRole: "superadmin" },
];

const adminActors = [
    { name: "anonymous", userRole: null, adminRole: null, expected: 401 },
    { name: "mentee", userRole: "mentee", adminRole: null, expected: 401 },
    { name: "mentor", userRole: "mentor", adminRole: null, expected: 401 },
    { name: "normal admin", userRole: null, adminRole: "normal", expected: 403 },
    { name: "super admin", userRole: null, adminRole: "super", expected: 200 },
];

const userRouteCases = [
    { name: "send connect request", method: "post", path: "/connect-requests", roles: ["mentee"] },
    { name: "cancel connect request", method: "delete", path: "/connect-requests/request-1", roles: ["mentee"] },
    { name: "view incoming requests", method: "get", path: "/connect-requests/incoming", roles: ["mentor"] },
    { name: "respond to connect request", method: "patch", path: "/connect-requests/request-1", roles: ["mentor"] },
    { name: "withdraw earnings", method: "post", path: "/mentor/earnings/withdraw", roles: ["mentor"] },
    { name: "view invoice", method: "get", path: "/invoices/request-1", roles: ["mentee"] },
    { name: "read messages", method: "get", path: "/messages/request-1", roles: ["mentee", "mentor"] },
    { name: "read notes", method: "get", path: "/notes/request-1", roles: ["mentee", "mentor"] },
    { name: "read private notes", method: "get", path: "/private-notes/request-1", roles: ["mentee", "mentor"] },
    { name: "read goals", method: "get", path: "/goals/request-1", roles: ["mentee", "mentor"] },
    { name: "read feedback", method: "get", path: "/feedback/request-1", roles: ["mentee", "mentor"] },
    { name: "read session slots", method: "get", path: "/sessions/request-1/slots", roles: ["mentee", "mentor"] },
    { name: "list slot locks for booking", method: "get", path: "/slot-locks/mentor-1", roles: ["mentee"] },
];

const execute = (route, actor) => {
    let call = request(app)[route.method](route.path);
    if (actor.userRole) call = call.set("x-user-role", actor.userRole);
    if (actor.adminRole) call = call.set("x-admin-role", actor.adminRole);
    return call;
};

describe("RBAC route matrix", () => {
    it.each(userRouteCases.flatMap((route) => userActors.map((actor) => ({ route, actor }))))(
        "$route.name as $actor.name returns the expected authorization result",
        async ({ route, actor }) => {
            const expected = actor.userRole && route.roles.includes(actor.userRole) ? 200 : actor.expected || 403;
            const response = await execute(route, actor);
            expect(response.status).toBe(expected);
        },
    );

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
