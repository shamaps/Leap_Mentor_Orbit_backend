/**
 * @fileoverview Unit tests for the payments client configuration.
 * The shared internal client is mocked so only this service's settings are checked.
 */

const mockClient = { get: jest.fn(), post: jest.fn(), put: jest.fn() };
const mockCreateInternalClient = jest.fn(() => mockClient);

jest.mock("@leapmentor/shared/utils/internalClient", () => ({
    createInternalClient: (config) => mockCreateInternalClient(config),
}));

const ENV_KEYS = ["PAYMENTS_SERVICE_URL", "ENGAGEMENT_TO_PAYMENTS_TOKEN", "INTERNAL_CALL_TIMEOUT_MS"];

const load = () => {
    let client;
    jest.isolateModules(() => {
        client = require("../../../src/clients/payments.client");
    });
    return client;
};

describe("Payments Client", () => {
    const saved = {};

    beforeEach(() => {
        ENV_KEYS.forEach((key) => { saved[key] = process.env[key]; delete process.env[key]; });
        mockCreateInternalClient.mockClear();
    });

    afterEach(() => {
        ENV_KEYS.forEach((key) => {
            if (saved[key] === undefined) delete process.env[key];
            else process.env[key] = saved[key];
        });
    });

    it("should be the shared internal client, called as engagement talking to payments", () => {
        const client = load();

        expect(client).toBe(mockClient);
        expect(mockCreateInternalClient).toHaveBeenCalledWith(expect.objectContaining({ caller: "engagement", target: "payments" }));
    });

    it("should read the base URL and the secret from the environment at call time", () => {
        load();
        const config = mockCreateInternalClient.mock.calls[0][0];

        expect(config.baseUrl()).toBeUndefined();
        expect(config.token()).toBeUndefined();

        process.env.PAYMENTS_SERVICE_URL = "http://payments:5004";
        process.env.ENGAGEMENT_TO_PAYMENTS_TOKEN = "secret";

        expect(config.baseUrl()).toBe("http://payments:5004");
        expect(config.token()).toBe("secret");
    });

    it("should time out after 3 seconds by default", () => {
        load();
        expect(mockCreateInternalClient.mock.calls[0][0].timeoutMs).toBe(3000);
    });

    it("should take the timeout from INTERNAL_CALL_TIMEOUT_MS", () => {
        process.env.INTERNAL_CALL_TIMEOUT_MS = "7500";
        load();
        expect(mockCreateInternalClient.mock.calls[0][0].timeoutMs).toBe(7500);
    });

    it("should fall back to 3 seconds when the timeout setting is not a number", () => {
        process.env.INTERNAL_CALL_TIMEOUT_MS = "soon";
        load();
        expect(mockCreateInternalClient.mock.calls[0][0].timeoutMs).toBe(3000);
    });
});
