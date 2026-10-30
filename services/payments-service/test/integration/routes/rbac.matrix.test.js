const request = require("supertest");
const express = require("express");

const mockOk = (req, res) => res.status(200).json({ success: true });
const mockController = new Proxy({}, { get: () => mockOk });

jest.mock("../../../src/config/container", () => ({
    earningsController: mockController,
    invoiceController: mockController,
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
app.use("/mentor/earnings", require("../../../src/routes/earnings.routes"));
app.use("/invoices", require("../../../src/routes/invoice.routes"));

const userActors = [
    { name: "anonymous", userRole: null, expected: 401 },
    { name: "mentee", userRole: "mentee" },
    { name: "mentor", userRole: "mentor" },
    { name: "normal admin", userRole: "admin" },
    { name: "super admin", userRole: "superadmin" },
];

const userRouteCases = [
    { name: "withdraw earnings", method: "post", path: "/mentor/earnings/withdraw", roles: ["mentor"] },
    { name: "view invoice", method: "get", path: "/invoices/request-1", roles: ["mentee"] },
];

const execute = (route, actor) => {
    let call = request(app)[route.method](route.path);
    if (actor.userRole) call = call.set("x-user-role", actor.userRole);
    if (actor.adminRole) call = call.set("x-admin-role", actor.adminRole);
    return call;
};

describe("Payments RBAC route matrix", () => {
    it.each(userRouteCases.flatMap((route) => userActors.map((actor) => ({ route, actor }))))(
        "$route.name as $actor.name returns the expected authorization result",
        async ({ route, actor }) => {
            const expected = actor.userRole && route.roles.includes(actor.userRole) ? 200 : actor.expected || 403;
            const response = await execute(route, actor);
            expect(response.status).toBe(expected);
        },
    );
});
