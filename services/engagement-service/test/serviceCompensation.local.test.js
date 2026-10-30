const createServiceCompensationService = require("../src/services/serviceCompensation.service");

const makeRepo = () => {
    const store = new Map();

    return {
        store,

        enqueue: async (key, action, payload) => {
            if (!store.has(key)) {
                store.set(key, {
                    _id: key,
                    key,
                    action,
                    payload,
                    status: "pending",
                    attempts: 0,
                });
            }
            return store.get(key);
        },

        complete: async (id, result) =>
            Object.assign(store.get(id), {
                status: "completed",
                result,
            }),

        fail: async (record, error) =>
            Object.assign(store.get(record._id), {
                status: "failed",
                lastError: error.message,
            }),

        scheduleRetry: async (record, error) =>
            Object.assign(store.get(record._id), {
                status: "pending",
                lastError: error.message,
            }),

        claimNext: async () => null,
    };
};

const makeDeps = (overrides = {}) => {
    const repo = overrides.repo || makeRepo();
    const calls = [];

    const paymentsClient = overrides.paymentsClient || {
        post: async (...args) => {
            calls.push(["payments.post", ...args]);
            return { data: { ok: true } };
        },
    };

    const catalogClient = overrides.catalogClient || {
        releaseSlot: async (...args) => {
            calls.push(["catalog.releaseSlot", ...args]);
            return { data: { ok: true } };
        },
        updateMentorRating: async (...args) => {
            calls.push(["catalog.updateMentorRating", ...args]);
            return { data: { ok: true } };
        },
        getMentorAvailability: async (...args) => {
            calls.push(["catalog.getMentorAvailability", ...args]);
            return { data: [] };
        },
    };

    const sessionOperations = overrides.sessionOperations || {
        releaseSessionSlot: async (...args) => {
            calls.push(["session.releaseSessionSlot", ...args]);
            return { data: { slot: { cancelledBy: "mentee" } } };
        },
        rescheduleSessionSlot: async (...args) => {
            calls.push(["session.rescheduleSessionSlot", ...args]);
            return { data: { ok: true } };
        },
        confirmBookingSlot: async (...args) => {
            calls.push(["session.confirmBookingSlot", ...args]);
            return { data: { ok: true } };
        },
        confirmSlot: async (...args) => {
            calls.push(["session.confirmSlot", ...args]);
            return { data: { ok: true } };
        },
    };

    const logger = overrides.logger || {
        info() { },
        debug() { },
        warn() { },
        error() { },
    };

    const svc = createServiceCompensationService(repo, {
        paymentsClient,
        catalogClient,
        sessionRepo: overrides.sessionRepo || null,
        sessionOperations,
        logger,
    });

    return { svc, repo, calls };
};

test("runs a compensation and completes its record", async () => {
    const { svc, repo, calls } = makeDeps();

    const result = await svc.run(
        "payments.release",
        { requestId: "request-1", menteeId: "mentee-1" },
        "release-1"
    );

    expect(result).toEqual({ ok: true });
    expect(repo.store.get("release-1").status).toBe("completed");
    expect(calls.length).toBe(1);
    expect(calls[0][0]).toBe("payments.post");
});

test("a completed key is returned from the record without running the operation again", async () => {
    const { svc, calls } = makeDeps();

    await svc.run("session.confirmBooking", {}, "same");
    await svc.run("session.confirmBooking", {}, "same");

    expect(
        calls.filter(([name]) => name === "session.confirmBookingSlot").length
    ).toBe(1);
});

const paymentsError = (status, message) =>
    Object.assign(new Error(message), {
        status,
        meta: { upstream: "payments" },
    });

const logSink = () => {
    const logs = { warn: [], error: [] };

    return {
        logs,
        logger: {
            info() { },
            debug() { },
            warn: (message) => logs.warn.push(message),
            error: (message) => logs.error.push(message),
        },
    };
};

test("payments.release 409 means nothing is left to release: record completes and returns already_settled", async () => {
    const { logger, logs } = logSink();

    const { svc, repo } = makeDeps({
        logger,
        paymentsClient: {
            post: async () => {
                throw paymentsError(409, "Escrow is already settled");
            },
        },
    });

    const result = await svc.run(
        "payments.release",
        { requestId: "request-1", menteeId: "mentee-1" },
        "release-409"
    );

    expect(result.skipped).toBe("already_settled");
    expect(result.reason).toBe("Escrow is already settled");
    expect(repo.store.get("release-409").status).toBe("completed");
    expect(logs.error.length).toBe(0);
});

test("a refund rejected with Payments 409 fails permanently and run rejects", async () => {
    const { logger, logs } = logSink();

    const { svc, repo } = makeDeps({
        logger,
        paymentsClient: {
            post: async () => {
                throw paymentsError(409, "Escrow is already settled");
            },
        },
    });

    await expect(
        svc.run(
            "payments.slotRefund",
            { requestId: "request-1", slotIndex: 0 },
            "refund-409"
        )
    ).rejects.toThrow(/Escrow is already settled/);

    expect(repo.store.get("refund-409").status).toBe("failed");
    expect(
        logs.error.some((message) => /needs manual action/.test(message))
    ).toBe(true);
});

test("a Payments refund error inside session.cancelSlot is classified as failed", async () => {
    const { svc, repo } = makeDeps({
        paymentsClient: {
            post: async () => {
                throw paymentsError(
                    422,
                    "Escrow balance too low for slot refund. Contact support."
                );
            },
        },
    });

    await expect(
        svc.run(
            "session.cancelSlot",
            {
                requestId: "request-1",
                slotIndex: 0,
                cancelledBy: "mentee",
                paymentStatus: "paid",
            },
            "cancel-422"
        )
    ).rejects.toThrow(/Escrow balance too low/);

    expect(repo.store.get("cancel-422").status).toBe("failed");
});

test("Payments 5xx errors and retryable 429 responses remain pending", async () => {
    const statuses = [503, 504, 502, 429];

    for (const [index, status] of statuses.entries()) {
        const key = `retry-${index}`;
        const { svc, repo } = makeDeps({
            paymentsClient: {
                post: async () => {
                    throw paymentsError(status, "Please try again later");
                },
            },
        });

        await expect(
            svc.run(
                "payments.slotRefund",
                { requestId: "request-1", slotIndex: index },
                key
            )
        ).rejects.toThrow(/Please try again later/);

        expect(repo.store.get(key).status).toBe("pending");
    }
});

test("non-Payments errors keep the existing retry behavior", async () => {
    const { svc, repo } = makeDeps({
        sessionOperations: {
            confirmSlot: async () => {
                throw Object.assign(new Error("Local operation failed"), {
                    status: 400,
                });
            },
        },
    });

    await expect(
        svc.run(
            "catalog.confirmSlot",
            { requestId: "request-1", menteeId: "mentee-1" },
            "local-error"
        )
    ).rejects.toThrow(/Local operation failed/);

    expect(repo.store.get("local-error").status).toBe("pending");
});

test("the sweeper completes a settled release and fails a rejected refund", async () => {
    const { logger } = logSink();
    const repo = makeRepo();

    const queue = [
        {
            _id: "release-record",
            key: "release-record",
            action: "payments.release",
            payload: { requestId: "request-1", menteeId: "mentee-1" },
            attempts: 1,
        },
        {
            _id: "refund-record",
            key: "refund-record",
            action: "payments.slotRefund",
            payload: { requestId: "request-1", slotIndex: 0 },
            attempts: 1,
        },
    ];

    for (const record of queue) {
        repo.store.set(record._id, record);
    }

    repo.claimNext = async () => queue.shift() || null;

    const svc = createServiceCompensationService(repo, {
        paymentsClient: {
            post: async () => {
                throw paymentsError(409, "Escrow is already settled");
            },
        },
        catalogClient: {},
        sessionRepo: null,
        sessionOperations: {},
        logger,
    });

    await svc.drain();

    expect(repo.store.get("release-record").status).toBe("completed");
    expect(repo.store.get("refund-record").status).toBe("failed");
});

test("a record at 10 attempts logs that compensation is stuck", async () => {
    const { logger, logs } = logSink();
    const repo = makeRepo();

    const record = {
        _id: "stuck-record",
        key: "stuck-record",
        action: "catalog.slotRelease",
        payload: { mentorId: "mentor-1" },
        attempts: 10,
    };

    repo.store.set(record._id, record);
    repo.claimNext = async () => record;

    const svc = createServiceCompensationService(repo, {
        paymentsClient: {},
        catalogClient: {
            releaseSlot: async () => {
                throw new Error("Temporary catalog failure");
            },
        },
        sessionRepo: null,
        sessionOperations: {},
        logger,
    });

    await svc.drain();

    expect(record.status).toBe("pending");
    expect(
        logs.error.some((message) =>
            /Compensation is stuck and needs attention/.test(message)
        )
    ).toBe(true);
});