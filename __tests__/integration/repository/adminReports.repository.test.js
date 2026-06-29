/**
 * @fileoverview Integration tests for Admin Reports Repository.
 */

const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../repositories/adminReports.repository");
const { makeReport } = require("../../fixtures/createTestData");

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Admin Reports Repository (Integration)", () => {
    let dummyUserId, dummyRequestId;

    beforeEach(() => {
        dummyUserId = new mongoose.Types.ObjectId();
        dummyRequestId = new mongoose.Types.ObjectId();
    });

    describe("countPendingReports", () => {
        it("should fetch documents matching state boundaries inside the $in array checks", async () => {
            // Uses production model rules (description >= 10, enum values validation checks matching complaint patterns)
            const staticFields = {
                description: "Test report details description parameter string",
                complaintType: "refund",
                reporterRole: "mentee",
                reportedUser: dummyUserId,
                reportedBy: dummyUserId,
                connectRequest: dummyRequestId,
            };

            await makeReport({ status: "open", ...staticFields });
            await makeReport({ status: "under_review", ...staticFields });

            const count = await repo.countPendingReports();
            expect(count).toBe(2);
        });
    });

    describe("countResolvedToday", () => {
        it("should screen targets that do not satisfy date parameters", async () => {
            const threshold = new Date("2026-06-28T00:00:00.000Z");

            const staticFields = {
                description: "Test report details description parameter string",
                complaintType: "refund",
                reporterRole: "mentee",
                reportedUser: dummyUserId,
                reportedBy: dummyUserId,
                connectRequest: dummyRequestId,
            };

            await makeReport({ status: "resolved", resolvedAt: new Date("2026-06-28T12:00:00.000Z"), ...staticFields });
            await makeReport({ status: "resolved", resolvedAt: new Date("2026-06-27T23:59:59.000Z"), ...staticFields });

            const todayCount = await repo.countResolvedToday(threshold);
            expect(todayCount).toBe(1);
        });
    });
});