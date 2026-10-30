const { mockLog } = require("../helpers");

jest.mock("../../utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
// Keep the real mail templates / nodemailer out of this suite.
jest.mock("../../utils/emails", () => ({
    sendWelcomeEmail: jest.fn().mockResolvedValue("sent-welcome"),
    sendResetEmail: jest.fn().mockResolvedValue("sent-reset"),
    NOT_A_FUNCTION: "ignored",
}));
jest.mock("../../utils/streams", () => ({ publish: jest.fn() }));

const emails = require("../../utils/emails");
const streams = require("../../utils/streams");
const defaultQueue = require("../../utils/emailQueue");

const { createEmailQueue, EMAIL_STREAM } = defaultQueue;

describe("EMAIL_STREAM", () => {
    test("is the stream the communication-service worker consumes", () => {
        expect(EMAIL_STREAM).toBe("stream:email");
    });
});

describe("createEmailQueue", () => {
    const setup = (overrides = {}) => {
        const publish = jest.fn().mockResolvedValue("1-0");
        const log = mockLog();
        const mails = {
            sendA: jest.fn().mockResolvedValue("direct-A"),
            sendB: jest.fn().mockResolvedValue("direct-B"),
            notAFunction: "x",
            alsoNot: 42,
        };
        const queue = createEmailQueue({ publish, emails: mails, log, ...overrides });
        return { queue, publish, log, mails };
    };

    test("exposes one wrapper per email function and lists them in EMAIL_TYPES", () => {
        const { queue } = setup();
        expect(queue.EMAIL_TYPES).toEqual(["sendA", "sendB"]);
        expect(typeof queue.sendA).toBe("function");
        expect(typeof queue.sendB).toBe("function");
        expect(queue.notAFunction).toBeUndefined();
    });

    test("an empty emails object yields an empty queue", () => {
        const queue = createEmailQueue({ publish: jest.fn(), emails: {}, log: mockLog() });
        expect(queue.EMAIL_TYPES).toEqual([]);
    });

    test("queues the email on the email stream with a unique idempotency key", async () => {
        const { queue, publish, mails } = setup();
        const payload = { to: "a@b.com", name: "Asha" };

        await expect(queue.sendA(payload)).resolves.toEqual({ queued: true });
        expect(publish).toHaveBeenCalledWith(EMAIL_STREAM, "sendA", payload, { key: expect.any(String) });
        expect(mails.sendA).not.toHaveBeenCalled();
    });

    test("each call gets its own key so two identical emails are not de-duplicated", async () => {
        const { queue, publish } = setup();
        await queue.sendA({ n: 1 });
        await queue.sendA({ n: 1 });
        const [k1, k2] = publish.mock.calls.map((c) => c[3].key);
        expect(k1).toMatch(/^[0-9a-f-]{36}$/);
        expect(k1).not.toBe(k2);
    });

    test("falls back to sending directly when the queue is unavailable, and logs why", async () => {
        const { queue, publish, log, mails } = setup();
        publish.mockRejectedValue(new Error("redis down"));
        const payload = { to: "a@b.com" };

        await expect(queue.sendB(payload)).resolves.toBe("direct-B");
        expect(mails.sendB).toHaveBeenCalledWith(payload);
        expect(log.warn).toHaveBeenCalledWith("Email queue unavailable; sending directly", { type: "sendB", error: "redis down" });
    });

    test("if the direct fallback also fails, that error reaches the caller", async () => {
        const { queue, publish, mails } = setup();
        publish.mockRejectedValue(new Error("redis down"));
        mails.sendA.mockRejectedValue(new Error("smtp down"));
        await expect(queue.sendA({})).rejects.toThrow("smtp down");
    });

    test("enabled:false skips the queue entirely and sends directly", async () => {
        const { queue, publish, mails } = setup({ enabled: false });
        await expect(queue.sendA({ to: "x" })).resolves.toBe("direct-A");
        expect(publish).not.toHaveBeenCalled();
        expect(mails.sendA).toHaveBeenCalledWith({ to: "x" });
    });
});

describe("default queue (wired to ./emails and ./streams)", () => {
    test("exposes the same function names as the emails module, plus helpers", () => {
        expect(defaultQueue.EMAIL_TYPES).toEqual(["sendWelcomeEmail", "sendResetEmail"]);
        expect(typeof defaultQueue.sendWelcomeEmail).toBe("function");
        expect(typeof defaultQueue.createEmailQueue).toBe("function");
    });

    test("publishes through utils/streams (resolved lazily, at call time)", async () => {
        streams.publish.mockResolvedValue("1-0");
        await expect(defaultQueue.sendResetEmail({ to: "a@b.com" })).resolves.toEqual({ queued: true });
        expect(streams.publish).toHaveBeenCalledWith(
            "stream:email", "sendResetEmail", { to: "a@b.com" }, { key: expect.any(String) });
        expect(emails.sendResetEmail).not.toHaveBeenCalled();
    });

    test("falls back to the real email function when publishing fails", async () => {
        streams.publish.mockRejectedValue(new Error("redis down"));
        await expect(defaultQueue.sendWelcomeEmail({ to: "a@b.com" })).resolves.toBe("sent-welcome");
        expect(emails.sendWelcomeEmail).toHaveBeenCalledWith({ to: "a@b.com" });
    });
});

describe("EMAIL_QUEUE_ENABLED=false", () => {
    test("the default queue sends directly and never touches Redis", async () => {
        const previous = process.env.EMAIL_QUEUE_ENABLED;
        process.env.EMAIL_QUEUE_ENABLED = "false";
        try {
            await jest.isolateModulesAsync(async () => {
                // Fresh registry: config is re-read (queue disabled); the top-level mocks are re-instantiated.
                const isolatedStreams = require("../../utils/streams");
                const queue = require("../../utils/emailQueue");

                await expect(queue.sendWelcomeEmail({ to: "a@b.com" })).resolves.toBe("sent-welcome");
                expect(isolatedStreams.publish).not.toHaveBeenCalled();
            });
        } finally {
            if (previous === undefined) delete process.env.EMAIL_QUEUE_ENABLED;
            else process.env.EMAIL_QUEUE_ENABLED = previous;
        }
    });
});
