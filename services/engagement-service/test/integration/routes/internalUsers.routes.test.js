/**
 * @fileoverview Integration tests for the internal user lifecycle routes.
 * Real router and real internal-auth middleware; only the service is mocked.
 * Mounted like the app does: /internal/users
 */

const request = require("supertest");
const express = require("express");

jest.mock("@leapmentor/shared/utils/logger", () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const mockService = {
    hardDelete: jest.fn(),
    softDelete: jest.fn(),
};

jest.mock("../../../src/config/container", () => ({
    internalUsersService: {
        hardDelete: (id) => mockService.hardDelete(id),
        softDelete: (id) => mockService.softDelete(id),
    },
}));

const internalUsersRoutes = require("../../../src/routes/internalUsers.routes");

const VALID_ID = "507f1f77bcf86cd799439011";
const TOKEN = "identity-to-engagement-secret";

const app = express();
app.use(express.json());
app.use("/internal/users", internalUsersRoutes);

const asIdentity = (req) => req.set("X-Caller-Service", "identity").set("X-Internal-Token", TOKEN);

describe("Internal Users Routes (Integration)", () => {
    const originalToken = process.env.IDENTITY_TO_ENGAGEMENT_TOKEN;

    beforeEach(() => {
        process.env.IDENTITY_TO_ENGAGEMENT_TOKEN = TOKEN;
        mockService.hardDelete.mockResolvedValue({ requests: 2 });
        mockService.softDelete.mockResolvedValue({ requests: 1 });
    });

    afterEach(() => jest.clearAllMocks());

    afterAll(() => {
        if (originalToken === undefined) delete process.env.IDENTITY_TO_ENGAGEMENT_TOKEN;
        else process.env.IDENTITY_TO_ENGAGEMENT_TOKEN = originalToken;
    });

    describe("service-to-service authentication", () => {
        it("rejects a call with no caller or token", async () => {
            await request(app).delete(`/internal/users/${VALID_ID}`).expect(401);
            expect(mockService.hardDelete).not.toHaveBeenCalled();
        });

        it("rejects a caller that is not identity, even with the right token", async () => {
            await request(app).delete(`/internal/users/${VALID_ID}`)
                .set("X-Caller-Service", "payments").set("X-Internal-Token", TOKEN)
                .expect(401);
            expect(mockService.hardDelete).not.toHaveBeenCalled();
        });

        it("rejects a wrong token", async () => {
            await request(app).delete(`/internal/users/${VALID_ID}`)
                .set("X-Caller-Service", "identity").set("X-Internal-Token", "wrong")
                .expect(401);
            expect(mockService.hardDelete).not.toHaveBeenCalled();
        });

        it("answers 503 when the shared secret is not configured on this service", async () => {
            delete process.env.IDENTITY_TO_ENGAGEMENT_TOKEN;
            await asIdentity(request(app).delete(`/internal/users/${VALID_ID}`)).expect(503);
            expect(mockService.hardDelete).not.toHaveBeenCalled();
        });
    });

    describe("DELETE /internal/users/:userId (hard delete)", () => {
        it("deletes the user's requests and returns the count", async () => {
            const res = await asIdentity(request(app).delete(`/internal/users/${VALID_ID}`)).expect(200);

            expect(res.body).toEqual({ success: true, data: { requests: 2 } });
            expect(mockService.hardDelete).toHaveBeenCalledWith(VALID_ID);
        });

        it("rejects an id that is not a 24-character hex ObjectId", async () => {
            const res = await asIdentity(request(app).delete("/internal/users/not-an-id")).expect(400);

            expect(res.body.success).toBe(false);
            expect(mockService.hardDelete).not.toHaveBeenCalled();
        });

        it("turns a service failure into an error response", async () => {
            mockService.hardDelete.mockRejectedValue(new Error("db down"));

            const res = await asIdentity(request(app).delete(`/internal/users/${VALID_ID}`));

            expect(res.status).toBeGreaterThanOrEqual(500);
            expect(res.body.success).toBe(false);
        });
    });

    describe("POST /internal/users/:userId/soft-delete", () => {
        it("cancels the user's pending requests and returns the count", async () => {
            const res = await asIdentity(request(app).post(`/internal/users/${VALID_ID}/soft-delete`)).expect(200);

            expect(res.body).toEqual({ success: true, data: { requests: 1 } });
            expect(mockService.softDelete).toHaveBeenCalledWith(VALID_ID);
        });

        it("rejects an invalid id", async () => {
            await asIdentity(request(app).post("/internal/users/123/soft-delete")).expect(400);
            expect(mockService.softDelete).not.toHaveBeenCalled();
        });
    });

    it("does not expose a restore route, because this service has no restore handler", async () => {
        await asIdentity(request(app).post(`/internal/users/${VALID_ID}/restore`)).expect(404);
    });
});
