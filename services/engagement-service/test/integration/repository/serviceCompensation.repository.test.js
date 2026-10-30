/**
 * @fileoverview Tests for the Service Compensation Repository.
 * The model is mocked, so these check the exact queries, the retry back-off and the leases.
 */

jest.mock("../../../src/models/ServiceCompensation", () => ({
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
}));

const ServiceCompensation = require("../../../src/models/ServiceCompensation");
const repository = require("../../../src/repositories/serviceCompensation.repository");

describe("Service Compensation Repository", () => {
    const NOW = new Date("2026-05-01T10:00:00.000Z");

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers().setSystemTime(NOW);
    });

    afterEach(() => jest.useRealTimers());

    const update = () => ServiceCompensation.updateOne.mock.calls[0];

    describe("enqueue", () => {
        it("should insert a pending record once per key and never overwrite an existing one", async () => {
            ServiceCompensation.findOneAndUpdate.mockResolvedValue({ key: "k1" });

            const record = await repository.enqueue("k1", "payments.release", { requestId: "r1" });

            expect(ServiceCompensation.findOneAndUpdate).toHaveBeenCalledWith(
                { key: "k1" },
                { $setOnInsert: { key: "k1", action: "payments.release", payload: { requestId: "r1" }, status: "pending", nextAttemptAt: NOW } },
                { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
            );
            expect(record).toEqual({ key: "k1" });
        });
    });

    describe("complete", () => {
        it("should store the result and release the lease", async () => {
            await repository.complete("id_1", { refundedAmount: 50 });

            expect(update()[0]).toEqual({ _id: "id_1" });
            expect(update()[1]).toEqual({
                $set: { status: "completed", result: { refundedAmount: 50 }, completedAt: NOW, leaseUntil: null, lastError: "" },
            });
        });
    });

    describe("scheduleRetry", () => {
        const retry = async (attempts, error = new Error("boom")) => {
            await repository.scheduleRetry({ _id: "id_1", attempts }, error);
            return update()[1].$set;
        };

        it("should keep the record pending, drop the lease and remember the error", async () => {
            const set = await retry(1);

            expect(update()[0]).toEqual({ _id: "id_1" });
            expect(set).toMatchObject({ status: "pending", leaseUntil: null, lastError: "boom" });
        });

        it("should wait one second after the first attempt and double each time", async () => {
            expect((await retry(0)).nextAttemptAt).toEqual(new Date(NOW.getTime() + 1000));
            jest.clearAllMocks();
            expect((await retry(1)).nextAttemptAt).toEqual(new Date(NOW.getTime() + 2000));
            jest.clearAllMocks();
            expect((await retry(3)).nextAttemptAt).toEqual(new Date(NOW.getTime() + 8000));
        });

        it("should never wait longer than 15 minutes, however many attempts have failed", async () => {
            expect((await retry(10)).nextAttemptAt).toEqual(new Date(NOW.getTime() + 15 * 60_000));
            jest.clearAllMocks();
            expect((await retry(500)).nextAttemptAt).toEqual(new Date(NOW.getTime() + 15 * 60_000));
        });

        it("should accept a plain string as the error and cut very long messages to 2000 characters", async () => {
            expect((await retry(1, "plain failure")).lastError).toBe("plain failure");
            jest.clearAllMocks();
            expect((await retry(1, new Error("x".repeat(5000)))).lastError).toHaveLength(2000);
        });

        it("should cope with a missing error instead of throwing", async () => {
            await repository.scheduleRetry({ _id: "id_1", attempts: 1 }, undefined);
            expect(update()[1].$set.lastError).toBe("undefined");
        });
    });

    describe("fail", () => {
        it("should mark the record failed for good and keep the reason", async () => {
            await repository.fail({ _id: "id_1" }, new Error("permanent 4xx"));

            expect(update()[0]).toEqual({ _id: "id_1" });
            expect(update()[1]).toEqual({ $set: { status: "failed", failedAt: NOW, leaseUntil: null, lastError: "permanent 4xx" } });
        });

        it("should accept a string error and truncate it to 2000 characters", async () => {
            await repository.fail({ _id: "id_1" }, "y".repeat(3000));
            expect(update()[1].$set.lastError).toHaveLength(2000);
        });
    });

    describe("claimNext", () => {
        it("should claim the oldest record that is due, or whose lease has expired, and lease it for a minute", async () => {
            ServiceCompensation.findOneAndUpdate.mockResolvedValue({ _id: "id_1" });
            const now = new Date("2026-06-01T00:00:00.000Z");

            const claimed = await repository.claimNext(now);

            expect(ServiceCompensation.findOneAndUpdate).toHaveBeenCalledWith(
                { $or: [
                    { status: "pending", nextAttemptAt: { $lte: now } },
                    { status: "processing", leaseUntil: { $lte: now } },
                ] },
                { $set: { status: "processing", leaseUntil: new Date(now.getTime() + 60_000) }, $inc: { attempts: 1 } },
                { returnDocument: "after", sort: { createdAt: 1 } },
            );
            expect(claimed).toEqual({ _id: "id_1" });
        });

        it("should use the current time when none is given", async () => {
            ServiceCompensation.findOneAndUpdate.mockResolvedValue(null);

            await expect(repository.claimNext()).resolves.toBeNull();

            expect(ServiceCompensation.findOneAndUpdate.mock.calls[0][1].$set.leaseUntil).toEqual(new Date(NOW.getTime() + 60_000));
        });
    });
});
