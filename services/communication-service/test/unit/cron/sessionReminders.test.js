/**
 * @fileoverview Unit tests for the session reminder cron job (24h and 1h reminders, IST slot times).
 */

jest.mock("node-cron", () => ({ schedule: jest.fn() }));
jest.mock("@leapmentor/shared/models/ConnectRequest", () => ({ find: jest.fn() }));
jest.mock("@leapmentor/shared/repositories/notification.repository", () => ({}));
jest.mock("@leapmentor/shared/utils/logger", () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

// The cron builds its notifier with makeCreateNotification(repo); hand it a recorder.
const mockCreateNotification = jest.fn();
jest.mock("@leapmentor/shared/utils/createNotification", () => () => mockCreateNotification);

const cron = require("node-cron");
const ConnectRequest = require("@leapmentor/shared/models/ConnectRequest");
const logger = require("@leapmentor/shared/utils/logger");
const { PLATFORM_TIMEZONE, IST_OFFSET_MS } = require("@leapmentor/shared/config/constants");
const { sendSessionReminders, startSessionReminderCron } = require("../../../src/cron/sessionReminders");

// A fixed "now" on a whole minute, so slot offsets are exact.
const NOW = new Date("2026-11-01T00:00:00.000Z");

const pad = (n) => String(n).padStart(2, "0");

// Slot date/time strings (IST wall-clock) for a session `minutesFromNow` minutes after NOW.
const slotFor = (minutesFromNow) => {
    const ist = new Date(NOW.getTime() + minutesFromNow * 60000 + IST_OFFSET_MS);
    return {
        date: `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}`,
        startTime: `${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`,
    };
};

const makeRequest = (minutesFromNow, over = {}) => ({
    _id: "req1",
    mentee: { _id: "mentee1", name: "Asha" },
    mentor: { _id: "mentor1", name: "Ravi" },
    confirmedSlot: slotFor(minutesFromNow),
    ...over,
});

// Makes ConnectRequest.find(...).populate(...).populate(...).lean() resolve to `rows`.
const givenRequests = (rows) => {
    const chain = {};
    chain.populate = jest.fn(() => chain);
    chain.lean = jest.fn().mockResolvedValue(rows);
    ConnectRequest.find.mockReturnValue(chain);
    return chain;
};

const titlesSent = () => mockCreateNotification.mock.calls.map(([n]) => n.title);

beforeEach(() => {
    mockCreateNotification.mockResolvedValue(undefined);
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
});
afterEach(() => {
    jest.useRealTimers();
});

describe("sendSessionReminders", () => {
    describe("querying", () => {
        it("should load accepted requests that have a confirmed slot, with mentee and mentor names", async () => {
            const chain = givenRequests([]);

            await sendSessionReminders();

            expect(ConnectRequest.find).toHaveBeenCalledWith({ status: "accepted", confirmedSlot: { $ne: null } });
            expect(chain.populate).toHaveBeenCalledWith("mentee", "name email");
            expect(chain.populate).toHaveBeenCalledWith("mentor", "name email");
            expect(chain.lean).toHaveBeenCalled();
        });

        it("should send nothing and log zero counts when there are no requests", async () => {
            givenRequests([]);

            await sendSessionReminders();

            expect(mockCreateNotification).not.toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith("Cron: session reminders complete", { reminder24Count: 0, reminder1Count: 0 });
        });
    });

    describe("24-hour reminder", () => {
        it("should notify the mentee and then the mentor for a session exactly 24 hours away", async () => {
            const request = makeRequest(24 * 60);
            givenRequests([request]);
            const { date, startTime } = request.confirmedSlot;

            await sendSessionReminders();

            expect(mockCreateNotification).toHaveBeenCalledTimes(2);
            expect(mockCreateNotification.mock.calls[0][0]).toEqual({
                recipient: "mentee1",
                type: "upcoming_session",
                title: "Session Tomorrow 📅",
                message: `Reminder: Your session with Ravi is tomorrow at ${startTime} on ${date}.`,
                metadata: { requestId: "req1", mentorId: "mentor1" },
            });
            expect(mockCreateNotification.mock.calls[1][0]).toEqual({
                recipient: "mentor1",
                type: "upcoming_session",
                title: "Session Tomorrow 📅",
                message: `Reminder: You have a session with Asha tomorrow at ${startTime} on ${date}.`,
                metadata: { requestId: "req1", menteeId: "mentee1" },
            });
            expect(logger.info).toHaveBeenCalledWith("Cron: session reminders complete", { reminder24Count: 1, reminder1Count: 0 });
        });

        it.each([1430, 1440, 1450])("should send at %s minutes (inside the +/-10 minute window)", async (minutes) => {
            givenRequests([makeRequest(minutes)]);

            await sendSessionReminders();

            expect(titlesSent()).toEqual(["Session Tomorrow 📅", "Session Tomorrow 📅"]);
        });

        it.each([1429, 1451])("should not send at %s minutes (just outside the window)", async (minutes) => {
            givenRequests([makeRequest(minutes)]);

            await sendSessionReminders();

            expect(mockCreateNotification).not.toHaveBeenCalled();
        });
    });

    describe("1-hour reminder", () => {
        it("should notify the mentee and then the mentor for a session one hour away", async () => {
            const request = makeRequest(60);
            givenRequests([request]);
            const { startTime } = request.confirmedSlot;

            await sendSessionReminders();

            expect(mockCreateNotification).toHaveBeenCalledTimes(2);
            expect(mockCreateNotification.mock.calls[0][0]).toEqual({
                recipient: "mentee1",
                type: "upcoming_session",
                title: "Session in 1 Hour ⏰",
                message: `Your session with Ravi starts in about 1 hour at ${startTime}.`,
                metadata: { requestId: "req1", mentorId: "mentor1" },
            });
            expect(mockCreateNotification.mock.calls[1][0]).toEqual({
                recipient: "mentor1",
                type: "upcoming_session",
                title: "Session in 1 Hour ⏰",
                message: `Your session with Asha starts in about 1 hour at ${startTime}.`,
                metadata: { requestId: "req1", menteeId: "mentee1" },
            });
            expect(logger.info).toHaveBeenCalledWith("Cron: session reminders complete", { reminder24Count: 0, reminder1Count: 1 });
        });

        it.each([50, 60, 70])("should send at %s minutes (inside the window)", async (minutes) => {
            givenRequests([makeRequest(minutes)]);

            await sendSessionReminders();

            expect(titlesSent()).toEqual(["Session in 1 Hour ⏰", "Session in 1 Hour ⏰"]);
        });

        it.each([49, 71])("should not send at %s minutes (just outside the window)", async (minutes) => {
            givenRequests([makeRequest(minutes)]);

            await sendSessionReminders();

            expect(mockCreateNotification).not.toHaveBeenCalled();
        });
    });

    describe("sessions that need no reminder", () => {
        it.each([-30, 5, 300, 720, 3000])("should ignore a session %s minutes away", async (minutes) => {
            givenRequests([makeRequest(minutes)]);

            await sendSessionReminders();

            expect(mockCreateNotification).not.toHaveBeenCalled();
        });

        it("should skip requests whose confirmed slot has no date or start time", async () => {
            givenRequests([
                makeRequest(60, { confirmedSlot: { startTime: "10:00" } }),
                makeRequest(60, { confirmedSlot: { date: "2026-11-01" } }),
                makeRequest(60, { confirmedSlot: {} }),
            ]);

            await sendSessionReminders();

            expect(mockCreateNotification).not.toHaveBeenCalled();
        });
    });

    describe("several requests", () => {
        it("should handle each request independently and count both reminder kinds", async () => {
            givenRequests([
                makeRequest(24 * 60, { _id: "r24" }),
                makeRequest(60, { _id: "r1" }),
                makeRequest(500, { _id: "later" }),
            ]);

            await sendSessionReminders();

            const sentFor = mockCreateNotification.mock.calls.map(([n]) => n.metadata.requestId);
            expect(sentFor).toEqual(["r24", "r24", "r1", "r1"]);
            expect(logger.info).toHaveBeenCalledWith("Cron: session reminders complete", { reminder24Count: 1, reminder1Count: 1 });
        });
    });

    describe("IST conversion", () => {
        it("should read the slot as India Standard Time, not UTC", async () => {
            // 06:30 IST on 2 Nov is 01:00 UTC on 2 Nov, i.e. 25h after NOW: outside the 24h window.
            givenRequests([makeRequest(0, { confirmedSlot: { date: "2026-11-02", startTime: "06:30" } })]);
            await sendSessionReminders();
            expect(mockCreateNotification).not.toHaveBeenCalled();

            // 05:30 IST on 2 Nov is 00:00 UTC on 2 Nov, i.e. exactly 24h after NOW.
            givenRequests([makeRequest(0, { confirmedSlot: { date: "2026-11-02", startTime: "05:30" } })]);
            await sendSessionReminders();
            expect(titlesSent()).toEqual(["Session Tomorrow 📅", "Session Tomorrow 📅"]);
        });

        it("should handle a slot that crosses midnight between UTC and IST", async () => {
            // 01:00 IST on 1 Nov is 19:30 UTC on 31 Oct, which is before NOW: already past.
            givenRequests([makeRequest(0, { confirmedSlot: { date: "2026-11-01", startTime: "01:00" } })]);

            await sendSessionReminders();

            expect(mockCreateNotification).not.toHaveBeenCalled();
        });
    });

    describe("failures", () => {
        it("should log the error and not throw when the database query fails", async () => {
            ConnectRequest.find.mockImplementation(() => { throw new Error("db down"); });

            await expect(sendSessionReminders()).resolves.toBeUndefined();

            expect(logger.error).toHaveBeenCalledWith(
                "Cron: session reminder error",
                expect.objectContaining({ error: "db down" })
            );
        });

        it("should log the error and not throw when sending a notification fails", async () => {
            givenRequests([makeRequest(60)]);
            mockCreateNotification.mockRejectedValue(new Error("notification store down"));

            await expect(sendSessionReminders()).resolves.toBeUndefined();

            expect(logger.error).toHaveBeenCalledWith(
                "Cron: session reminder error",
                expect.objectContaining({ error: "notification store down" })
            );
        });
    });
});

describe("startSessionReminderCron", () => {
    it("should schedule the job every 10 minutes in the platform timezone", () => {
        startSessionReminderCron();

        expect(cron.schedule).toHaveBeenCalledTimes(1);
        expect(cron.schedule).toHaveBeenCalledWith("*/10 * * * *", sendSessionReminders, { timezone: PLATFORM_TIMEZONE });
    });

    it("should log that the job was scheduled", () => {
        startSessionReminderCron();

        expect(logger.info).toHaveBeenCalledWith("Cron: session reminders scheduled");
    });
});