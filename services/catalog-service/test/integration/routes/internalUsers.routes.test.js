/**
 * @fileoverview Routing tests for the Catalog user-lifecycle endpoints (called by Identity only).
 */

const request = require("supertest");
const express = require("express");
const AppError = require("@leapmentor/shared/utils/appError");

const mockUserLifecycleService = {
    hardDelete: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
};

jest.mock("../../../src/config/container", () => ({
    userLifecycleService: mockUserLifecycleService,
}));

const internalUsersRoutes = require("../../../src/routes/internalUsers.routes");

const TOKEN = "identity-to-catalog-secret";
const USER_ID = "a".repeat(24);

const app = express();
app.use(express.json());
app.use("/internal/users", internalUsersRoutes);

const asIdentity = (req) => req.set("x-caller-service", "identity").set("x-internal-token", TOKEN);

let previousToken;
beforeAll(() => {
    previousToken = process.env.IDENTITY_TO_CATALOG_TOKEN;
    process.env.IDENTITY_TO_CATALOG_TOKEN = TOKEN;
});
afterAll(() => {
    if (previousToken === undefined) delete process.env.IDENTITY_TO_CATALOG_TOKEN;
    else process.env.IDENTITY_TO_CATALOG_TOKEN = previousToken;
});

describe("Catalog Internal User Lifecycle Routes (Integration)", () => {
    describe("authentication", () => {
        it("should reject calls without credentials", async () => {
            const res = await request(app).delete(`/internal/users/${USER_ID}`);

            expect(res.status).toBe(401);
            expect(mockUserLifecycleService.hardDelete).not.toHaveBeenCalled();
        });

        it("should reject services other than Identity, even with a configured token", async () => {
            process.env.ENGAGEMENT_TO_CATALOG_TOKEN = "engagement-secret";
            try {
                const res = await request(app)
                    .delete(`/internal/users/${USER_ID}`)
                    .set("x-caller-service", "engagement")
                    .set("x-internal-token", "engagement-secret");

                expect(res.status).toBe(401);
                expect(mockUserLifecycleService.hardDelete).not.toHaveBeenCalled();
            } finally {
                delete process.env.ENGAGEMENT_TO_CATALOG_TOKEN;
            }
        });

        it("should reject a wrong token", async () => {
            const res = await request(app)
                .post(`/internal/users/${USER_ID}/soft-delete`)
                .set("x-caller-service", "identity")
                .set("x-internal-token", "wrong");

            expect(res.status).toBe(401);
            expect(mockUserLifecycleService.softDelete).not.toHaveBeenCalled();
        });

        it("should answer 503 when the Identity token is not configured on this service", async () => {
            delete process.env.IDENTITY_TO_CATALOG_TOKEN;
            try {
                const res = await asIdentity(request(app).post(`/internal/users/${USER_ID}/restore`));

                expect(res.status).toBe(503);
                expect(mockUserLifecycleService.restore).not.toHaveBeenCalled();
            } finally {
                process.env.IDENTITY_TO_CATALOG_TOKEN = TOKEN;
            }
        });
    });

    describe("DELETE /:userId", () => {
        it("should hard-delete the user's profiles through the service", async () => {
            mockUserLifecycleService.hardDelete.mockResolvedValue({ mentorProfiles: 1, menteeProfiles: 1 });

            const res = await asIdentity(request(app).delete(`/internal/users/${USER_ID}`));

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ success: true, data: { mentorProfiles: 1, menteeProfiles: 1 } });
            expect(mockUserLifecycleService.hardDelete).toHaveBeenCalledWith(USER_ID);
        });

        it("should reject a malformed user id with 400", async () => {
            const res = await asIdentity(request(app).delete("/internal/users/not-an-id"));

            expect(res.status).toBe(400);
            expect(res.body.message).toBe("userId must be a valid ID");
            expect(mockUserLifecycleService.hardDelete).not.toHaveBeenCalled();
        });

        it("should hide unexpected failures behind a 500 so Identity retries", async () => {
            mockUserLifecycleService.hardDelete.mockRejectedValue(new Error("db down"));

            const res = await asIdentity(request(app).delete(`/internal/users/${USER_ID}`));

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ success: false, message: "Internal server error" });
        });
    });

    describe("POST /:userId/soft-delete", () => {
        it("should soft-delete the user's profiles", async () => {
            mockUserLifecycleService.softDelete.mockResolvedValue({ mentorProfiles: 1, menteeProfiles: 0 });

            const res = await asIdentity(request(app).post(`/internal/users/${USER_ID}/soft-delete`));

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ success: true, data: { mentorProfiles: 1, menteeProfiles: 0 } });
            expect(mockUserLifecycleService.softDelete).toHaveBeenCalledWith(USER_ID);
        });

        it("should reject a malformed user id with 400", async () => {
            const res = await asIdentity(request(app).post("/internal/users/xyz/soft-delete"));

            expect(res.status).toBe(400);
            expect(mockUserLifecycleService.softDelete).not.toHaveBeenCalled();
        });

        it("should map an AppError raised by the service to its status", async () => {
            mockUserLifecycleService.softDelete.mockRejectedValue(new AppError(404, "User not found"));

            const res = await asIdentity(request(app).post(`/internal/users/${USER_ID}/soft-delete`));

            expect(res.status).toBe(404);
            expect(res.body.message).toBe("User not found");
        });
    });

    describe("POST /:userId/restore", () => {
        it("should restore the user's profiles", async () => {
            mockUserLifecycleService.restore.mockResolvedValue({ mentorProfiles: 0, menteeProfiles: 1 });

            const res = await asIdentity(request(app).post(`/internal/users/${USER_ID}/restore`));

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ success: true, data: { mentorProfiles: 0, menteeProfiles: 1 } });
            expect(mockUserLifecycleService.restore).toHaveBeenCalledWith(USER_ID);
        });

        it("should reject a malformed user id with 400", async () => {
            const res = await asIdentity(request(app).post("/internal/users/xyz/restore"));

            expect(res.status).toBe(400);
            expect(mockUserLifecycleService.restore).not.toHaveBeenCalled();
        });
    });

    it("should not expose routes that were not declared (for example GET)", async () => {
        const res = await asIdentity(request(app).get(`/internal/users/${USER_ID}`));

        expect(res.status).toBe(404);
    });
});
