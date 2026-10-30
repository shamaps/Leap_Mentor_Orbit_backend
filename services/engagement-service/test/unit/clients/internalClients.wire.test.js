/**
 * @fileoverview Wire-level tests for the catalog and payments clients.
 * The real shared client runs; only fetch is replaced. This checks the URL, method,
 * headers and body that actually leave the service, and the "not configured" failures.
 */

const ENV_KEYS = [
    "CATALOG_SERVICE_URL", "ENGAGEMENT_TO_CATALOG_TOKEN",
    "PAYMENTS_SERVICE_URL", "ENGAGEMENT_TO_PAYMENTS_TOKEN",
    "INTERNAL_CALL_TIMEOUT_MS",
];

jest.mock("@leapmentor/shared/utils/logger", () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const catalog = require("../../../src/clients/catalog.client");
const payments = require("../../../src/clients/payments.client");

const jsonResponse = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
});

describe("Catalog and payments clients on the wire", () => {
    const saved = {};
    let fetchSpy;

    beforeEach(() => {
        ENV_KEYS.forEach((key) => { saved[key] = process.env[key]; delete process.env[key]; });
        process.env.CATALOG_SERVICE_URL = "http://catalog:5002/";
        process.env.ENGAGEMENT_TO_CATALOG_TOKEN = "catalog-secret";
        process.env.PAYMENTS_SERVICE_URL = "http://payments:5004";
        process.env.ENGAGEMENT_TO_PAYMENTS_TOKEN = "payments-secret";
        fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse({ success: true, data: { ok: 1 } }));
    });

    afterEach(() => {
        fetchSpy.mockRestore();
        ENV_KEYS.forEach((key) => {
            if (saved[key] === undefined) delete process.env[key];
            else process.env[key] = saved[key];
        });
    });

    it("should send a slot lock as an authenticated, idempotent POST with a JSON body", async () => {
        const lock = { mentorId: "m1", menteeId: "u1", date: "2026-07-01", startTime: "10:00", endTime: "11:00" };

        const res = await catalog.lockSlot(lock);

        const [url, options] = fetchSpy.mock.calls[0];
        expect(url).toBe("http://catalog:5002/internal/slots/lock"); // the trailing slash on the base URL is dropped
        expect(options.method).toBe("POST");
        expect(options.headers).toMatchObject({
            "X-Internal-Token": "catalog-secret",
            "X-Caller-Service": "engagement",
            "Idempotency-Key": "slot:lock:m1:2026-07-01:10:00:11:00:u1",
            "Content-Type": "application/json",
        });
        expect(JSON.parse(options.body)).toEqual(lock);
        expect(res).toEqual({ success: true, data: { ok: 1 } });
    });

    it("should read a mentor's availability with a plain GET and no body", async () => {
        await catalog.getMentorAvailability("m1");

        const [url, options] = fetchSpy.mock.calls[0];
        expect(url).toBe("http://catalog:5002/internal/mentors/m1/availability");
        expect(options.method).toBe("GET");
        expect(options.body).toBeUndefined();
    });

    it("should use the payments address and secret for payments calls", async () => {
        await payments.get("/internal/wallets/u1/balance");

        const [url, options] = fetchSpy.mock.calls[0];
        expect(url).toBe("http://payments:5004/internal/wallets/u1/balance");
        expect(options.headers["X-Internal-Token"]).toBe("payments-secret");
        expect(options.headers["X-Caller-Service"]).toBe("engagement");
    });

    it("should fail with 503 and never call out when the catalog address is missing", async () => {
        delete process.env.CATALOG_SERVICE_URL;

        await expect(catalog.getMentorAvailability("m1")).rejects.toMatchObject({ status: 503, message: "Catalog service is not configured" });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should fail with 503 and never call out when the payments secret is missing", async () => {
        delete process.env.ENGAGEMENT_TO_PAYMENTS_TOKEN;

        await expect(payments.get("/internal/wallets/u1/balance")).rejects.toMatchObject({ status: 503 });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should pass a 4xx answer from the other service up as an error without retrying", async () => {
        fetchSpy.mockResolvedValue(jsonResponse({ success: false, message: "Slot taken" }, 409));

        await expect(catalog.lockSlot({ mentorId: "m1", menteeId: "u1", date: "d", startTime: "s", endTime: "e" }))
            .rejects.toMatchObject({ status: 409 });
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
});
