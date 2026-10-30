// Guards the boundary: catalog must not expose or perform ConnectRequest writes.
const fs = require("node:fs");
const path = require("node:path");
const createInternalOperationsService = require("../src/services/internalOperations.service");

const src = (rel) =>
    fs.readFileSync(path.join(__dirname, "..", "src", rel), "utf8");

describe("internalOperations.service", () => {
    test("service exposes only catalog-owned operations", () => {
        const svc = createInternalOperationsService({}, {});

        expect(Object.keys(svc).sort()).toEqual([
            "getMentorAvailability",
            "lockSlot",
            "recordCompletedSession",
            "releaseSlot",
            "updateMentorRating",
        ]);
    });

    test("repository no longer touches ConnectRequest", () => {
        const code = src("repositories/internalOperations.repository.js");

        expect(/ConnectRequest/.test(code)).toBe(false);

        for (const removed of [
            "markParticipantComplete",
            "markCompletedAtIfMissing",
            "confirmBooking",
            "applyReschedule",
            "saveSession",
            "findSessionDocument",
        ]) {
            expect(code).not.toContain(removed);
        }
    });

    test("internal routes no longer expose session or request mutations", () => {
        const code = src("routes/internal.routes.js");

        for (const gone of [
            "/sessions/:requestId/slots/:slotIndex/confirm",
            "/sessions/:requestId/slots/:slotIndex/release",
            "/sessions/:requestId/slots/:slotIndex/reschedule",
            "/requests/:requestId/confirm-slot",
        ]) {
            expect(code).not.toContain(gone);
        }

        for (const kept of [
            "/slots/lock",
            "/slots/release",
            "/mentors/:mentorId/rating",
            "/mentors/:mentorId/availability",
        ]) {
            expect(code).toContain(kept);
        }
    });

    test("updateMentorRating validates input and returns the stored values", async () => {
        const repo = {
            updateMentorRating: async (id, avg, count) => ({
                avgRating: avg,
                ratingCount: count,
            }),
        };

        const svc = createInternalOperationsService(repo, {});
        const id = "a".repeat(24);

        await expect(
            svc.updateMentorRating({
                mentorId: id,
                avgRating: 4.5,
                ratingCount: 3,
            })
        ).resolves.toEqual({
            mentorId: id,
            avgRating: 4.5,
            ratingCount: 3,
        });

        await expect(
            svc.updateMentorRating({
                mentorId: "x",
                avgRating: 4,
                ratingCount: 1,
            })
        ).rejects.toMatchObject({ status: 400 });

        await expect(
            svc.updateMentorRating({
                mentorId: id,
                avgRating: 6,
                ratingCount: 1,
            })
        ).rejects.toMatchObject({ status: 400 });

        await expect(
            svc.updateMentorRating({
                mentorId: id,
                avgRating: 4,
                ratingCount: -1,
            })
        ).rejects.toMatchObject({ status: 400 });
    });

    test("releaseSlot stays idempotent and surfaces lock-service errors", async () => {
        const ok = createInternalOperationsService(
            {},
            { unlockSlot: async () => ({ status: 200, body: {} }) }
        );

        await expect(ok.releaseSlot({})).resolves.toEqual({
            released: true,
        });

        const bad = createInternalOperationsService(
            {},
            {
                unlockSlot: async () => ({
                    status: 500,
                    body: { message: "db down" },
                }),
            }
        );

        await expect(bad.releaseSlot({})).rejects.toMatchObject({
            status: 500,
        });
    });
});
