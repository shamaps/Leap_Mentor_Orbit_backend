/**
 * @fileoverview Unit tests for the catalog client: configuration, request paths,
 * bodies and idempotency keys. The shared internal client is mocked.
 */

const mockClient = {
    get: jest.fn().mockResolvedValue({ data: "get" }),
    post: jest.fn().mockResolvedValue({ data: "post" }),
    put: jest.fn().mockResolvedValue({ data: "put" }),
};
const mockCreateInternalClient = jest.fn(() => mockClient);

jest.mock("@leapmentor/shared/utils/internalClient", () => ({
    createInternalClient: (config) => mockCreateInternalClient(config),
}));

const ENV_KEYS = ["CATALOG_SERVICE_URL", "ENGAGEMENT_TO_CATALOG_TOKEN", "INTERNAL_CALL_TIMEOUT_MS"];

const load = () => {
    let client;
    jest.isolateModules(() => {
        client = require("../../../src/clients/catalog.client");
    });
    return client;
};

describe("Catalog Client", () => {
    const saved = {};
    let catalog;

    const lock = { mentorId: "m1", menteeId: "u1", date: "2026-07-01", startTime: "10:00", endTime: "11:00" };

    beforeEach(() => {
        ENV_KEYS.forEach((key) => { saved[key] = process.env[key]; delete process.env[key]; });
        jest.clearAllMocks();
        catalog = load();
    });

    afterEach(() => {
        ENV_KEYS.forEach((key) => {
            if (saved[key] === undefined) delete process.env[key];
            else process.env[key] = saved[key];
        });
    });

    describe("configuration", () => {
        it("should be built as engagement talking to catalog", () => {
            expect(mockCreateInternalClient).toHaveBeenCalledWith(expect.objectContaining({ caller: "engagement", target: "catalog" }));
        });

        it("should read the base URL and the secret from the environment at call time", () => {
            const config = mockCreateInternalClient.mock.calls[0][0];
            expect(config.baseUrl()).toBeUndefined();

            process.env.CATALOG_SERVICE_URL = "http://catalog:5002";
            process.env.ENGAGEMENT_TO_CATALOG_TOKEN = "secret";

            expect(config.baseUrl()).toBe("http://catalog:5002");
            expect(config.token()).toBe("secret");
        });

        it("should default to a 3 second timeout and honour INTERNAL_CALL_TIMEOUT_MS", () => {
            expect(mockCreateInternalClient.mock.calls[0][0].timeoutMs).toBe(3000);

            mockCreateInternalClient.mockClear();
            process.env.INTERNAL_CALL_TIMEOUT_MS = "9000";
            load();
            expect(mockCreateInternalClient.mock.calls[0][0].timeoutMs).toBe(9000);
        });

        it("should keep the generic request methods of the shared client", () => {
            expect(catalog.get).toBe(mockClient.get);
            expect(catalog.post).toBe(mockClient.post);
            expect(catalog.put).toBe(mockClient.put);
        });
    });

    describe("lockSlot", () => {
        it("should post the slot with a key built from the mentor, the time and the mentee", async () => {
            const res = await catalog.lockSlot(lock);

            expect(mockClient.post).toHaveBeenCalledWith("/internal/slots/lock", {
                body: lock,
                idempotencyKey: "slot:lock:m1:2026-07-01:10:00:11:00:u1",
            });
            expect(res).toEqual({ data: "post" });
        });

        it("should use the caller's key when one is given", async () => {
            await catalog.lockSlot(lock, "my-key");
            expect(mockClient.post.mock.calls[0][1].idempotencyKey).toBe("my-key");
        });
    });

    describe("releaseSlot", () => {
        it("should post to the release path with its own key prefix", async () => {
            await catalog.releaseSlot(lock);

            expect(mockClient.post).toHaveBeenCalledWith("/internal/slots/release", {
                body: lock,
                idempotencyKey: "slot:release:m1:2026-07-01:10:00:11:00:u1",
            });
        });

        it("should use the caller's key when one is given", async () => {
            await catalog.releaseSlot(lock, "release-key");
            expect(mockClient.post.mock.calls[0][1].idempotencyKey).toBe("release-key");
        });
    });

    describe("recordCompletedSession", () => {
        it("should post the request id for the mentor, keyed by the request so it counts once", async () => {
            await catalog.recordCompletedSession({ mentorId: "m1", requestId: "req_9" });

            expect(mockClient.post).toHaveBeenCalledWith("/internal/mentors/m1/completed-sessions", {
                body: { requestId: "req_9" },
                idempotencyKey: "mentor:completed-session:req_9",
            });
        });
    });

    describe("updateMentorRating", () => {
        it("should put the rating and count, keyed by the mentor and the count", async () => {
            const res = await catalog.updateMentorRating({ mentorId: "m1", avgRating: 4.5, ratingCount: 12 });

            expect(mockClient.put).toHaveBeenCalledWith("/internal/mentors/m1/rating", {
                body: { avgRating: 4.5, ratingCount: 12 },
                idempotencyKey: "mentor:rating:m1:12",
            });
            expect(res).toEqual({ data: "put" });
        });

        it("should use the caller's key when one is given", async () => {
            await catalog.updateMentorRating({ mentorId: "m1", avgRating: 4, ratingCount: 2 }, "rating-key");
            expect(mockClient.put.mock.calls[0][1].idempotencyKey).toBe("rating-key");
        });
    });

    describe("getMentorAvailability", () => {
        it("should read the mentor's availability", async () => {
            const res = await catalog.getMentorAvailability("m1");

            expect(mockClient.get).toHaveBeenCalledWith("/internal/mentors/m1/availability");
            expect(res).toEqual({ data: "get" });
        });
    });
});
