/**
 * @fileoverview Unit tests for the nightly availability cleanup cron.
 * Models, node-cron and the logger are mocked, so only the cleanup logic is under test.
 */

const mockSchedule = jest.fn();
const mockAvailabilityFind = jest.fn();
const mockMentorUpdate = jest.fn();
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

jest.mock("node-cron", () => ({ schedule: (...args) => mockSchedule(...args) }));
jest.mock("@leapmentor/shared/models/Availability", () => ({ find: (...args) => mockAvailabilityFind(...args) }));
jest.mock("@leapmentor/shared/models/MentorProfile", () => ({ findOneAndUpdate: (...args) => mockMentorUpdate(...args) }));
jest.mock("@leapmentor/shared/config/constants", () => ({ PLATFORM_TIMEZONE: "Asia/Kolkata" }));
jest.mock("@leapmentor/shared/utils/logger", () => mockLogger);

const { cleanupAvailability, startCleanupCron } = require("../../../src/cron/cleanupAvailability");

const MENTOR_A = "a".repeat(24);
const MENTOR_B = "b".repeat(24);

// getTodayStr() reads local time, so the fake "now" is built from local components.
const TODAY = "2026-10-29";

const makeAvailability = (mentor, dates) => ({
    mentor,
    specificDates: dates.map((date) => ({ date, slots: [{ startTime: "09:00", endTime: "10:00" }] })),
    save: jest.fn().mockResolvedValue(undefined),
});

beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 29, 12, 0, 0));
    mockAvailabilityFind.mockResolvedValue([]);
    mockMentorUpdate.mockResolvedValue({});
});

afterEach(() => {
    jest.useRealTimers();
});

describe("cleanupAvailability", () => {
    it("should only load availability documents that have at least one specific date", async () => {
        await cleanupAvailability();

        expect(mockAvailabilityFind).toHaveBeenCalledWith({ "specificDates.0": { $exists: true } });
    });

    it("should do nothing and still log a summary when there are no documents", async () => {
        await cleanupAvailability();

        expect(mockMentorUpdate).not.toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith(
            "Cron: availability cleanup complete",
            { totalDocsUpdated: 0, totalDatesRemoved: 0, totalUnpublished: 0 }
        );
    });

    it("should log the computed local date when it starts", async () => {
        await cleanupAvailability();

        expect(mockLogger.info).toHaveBeenCalledWith("Cron: availability cleanup running", { today: TODAY });
    });

    it("should remove past dates and save the document", async () => {
        const avail = makeAvailability(MENTOR_A, ["2026-10-27", "2026-10-28", "2026-11-02"]);
        mockAvailabilityFind.mockResolvedValue([avail]);

        await cleanupAvailability();

        expect(avail.specificDates.map((d) => d.date)).toEqual(["2026-11-02"]);
        expect(avail.save).toHaveBeenCalledTimes(1);
    });

    it("should keep today's date, since only dates before today are expired", async () => {
        const avail = makeAvailability(MENTOR_A, ["2026-10-28", TODAY]);
        mockAvailabilityFind.mockResolvedValue([avail]);

        await cleanupAvailability();

        expect(avail.specificDates.map((d) => d.date)).toEqual([TODAY]);
    });

    it("should keep all future dates and skip the save when nothing expired", async () => {
        const avail = makeAvailability(MENTOR_A, [TODAY, "2026-10-30", "2027-01-01"]);
        mockAvailabilityFind.mockResolvedValue([avail]);

        await cleanupAvailability();

        expect(avail.specificDates).toHaveLength(3);
        expect(avail.save).not.toHaveBeenCalled();
        expect(mockMentorUpdate).not.toHaveBeenCalled();
    });

    it("should compare dates across a month and year boundary correctly", async () => {
        jest.setSystemTime(new Date(2027, 0, 1, 0, 5, 0));
        const avail = makeAvailability(MENTOR_A, ["2026-12-31", "2027-01-01"]);
        mockAvailabilityFind.mockResolvedValue([avail]);

        await cleanupAvailability();

        expect(avail.specificDates.map((d) => d.date)).toEqual(["2027-01-01"]);
    });

    it("should zero-pad single-digit months and days in the cutoff date", async () => {
        jest.setSystemTime(new Date(2026, 2, 5, 12, 0, 0));
        const avail = makeAvailability(MENTOR_A, ["2026-03-04", "2026-03-05"]);
        mockAvailabilityFind.mockResolvedValue([avail]);

        await cleanupAvailability();

        expect(mockLogger.info).toHaveBeenCalledWith("Cron: availability cleanup running", { today: "2026-03-05" });
        expect(avail.specificDates.map((d) => d.date)).toEqual(["2026-03-05"]);
    });

    it("should unpublish the mentor when no future dates remain", async () => {
        const avail = makeAvailability(MENTOR_A, ["2026-10-01", "2026-10-02"]);
        mockAvailabilityFind.mockResolvedValue([avail]);

        await cleanupAvailability();

        expect(avail.save).toHaveBeenCalledTimes(1);
        expect(mockMentorUpdate).toHaveBeenCalledTimes(1);
        expect(mockMentorUpdate).toHaveBeenCalledWith({ user: MENTOR_A }, { isProfilePublished: false });
        expect(mockLogger.info).toHaveBeenCalledWith("Cron: mentor auto-unpublished", { mentorId: MENTOR_A });
    });

    it("should save before unpublishing so a failed save never hides a mentor", async () => {
        const avail = makeAvailability(MENTOR_A, ["2026-10-01"]);
        avail.save.mockRejectedValue(new Error("write failed"));
        mockAvailabilityFind.mockResolvedValue([avail]);

        await cleanupAvailability();

        expect(mockMentorUpdate).not.toHaveBeenCalled();
    });

    it("should keep the mentor published while at least one future date remains", async () => {
        const avail = makeAvailability(MENTOR_A, ["2026-10-01", "2026-11-15"]);
        mockAvailabilityFind.mockResolvedValue([avail]);

        await cleanupAvailability();

        expect(avail.save).toHaveBeenCalledTimes(1);
        expect(mockMentorUpdate).not.toHaveBeenCalled();
    });

    it("should process every document and report accurate totals", async () => {
        const expiredOnly = makeAvailability(MENTOR_A, ["2026-10-01", "2026-10-02"]); // 2 removed, unpublished
        const partlyExpired = makeAvailability(MENTOR_B, ["2026-10-03", "2026-12-01"]); // 1 removed
        const untouched = makeAvailability("c".repeat(24), ["2026-12-05"]); // nothing removed
        mockAvailabilityFind.mockResolvedValue([expiredOnly, partlyExpired, untouched]);

        await cleanupAvailability();

        expect(expiredOnly.save).toHaveBeenCalledTimes(1);
        expect(partlyExpired.save).toHaveBeenCalledTimes(1);
        expect(untouched.save).not.toHaveBeenCalled();
        expect(mockMentorUpdate).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith(
            "Cron: availability cleanup complete",
            { totalDocsUpdated: 2, totalDatesRemoved: 3, totalUnpublished: 1 }
        );
    });

    it("should not throw when the database query fails and should log the error instead", async () => {
        mockAvailabilityFind.mockRejectedValue(new Error("mongo unavailable"));

        await expect(cleanupAvailability()).resolves.toBeUndefined();

        expect(mockLogger.error).toHaveBeenCalledWith(
            "Cron: availability cleanup error",
            expect.objectContaining({ error: "mongo unavailable", stack: expect.any(String) })
        );
    });

    it("should stop at the first failing document and log the error without crashing", async () => {
        const failing = makeAvailability(MENTOR_A, ["2026-10-01"]);
        failing.save.mockRejectedValue(new Error("write failed"));
        const next = makeAvailability(MENTOR_B, ["2026-10-01"]);
        mockAvailabilityFind.mockResolvedValue([failing, next]);

        await expect(cleanupAvailability()).resolves.toBeUndefined();

        expect(mockLogger.error).toHaveBeenCalledWith(
            "Cron: availability cleanup error",
            expect.objectContaining({ error: "write failed" })
        );
        expect(next.save).not.toHaveBeenCalled();
    });
});

describe("startCleanupCron", () => {
    it("should schedule the cleanup for midnight every day in the platform timezone", () => {
        startCleanupCron();

        expect(mockSchedule).toHaveBeenCalledTimes(1);
        expect(mockSchedule).toHaveBeenCalledWith("0 0 * * *", cleanupAvailability, { timezone: "Asia/Kolkata" });
    });

    it("should log that the cron is scheduled", () => {
        startCleanupCron();

        expect(mockLogger.info).toHaveBeenCalledWith("Cron: availability cleanup scheduled");
    });

    it("should not run the cleanup itself when scheduling", () => {
        startCleanupCron();

        expect(mockAvailabilityFind).not.toHaveBeenCalled();
    });
});
