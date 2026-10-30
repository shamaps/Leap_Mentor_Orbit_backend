jest.mock("@leapmentor/shared/utils/internalClient", () => ({
    createInternalClient: jest.fn(() => ({ marker: "engagement-client" })),
}));

const ENV_KEYS = [
    "CATALOG_SERVICE_URL", "ENGAGEMENT_SERVICE_URL", "PAYMENTS_SERVICE_URL",
    "IDENTITY_TO_CATALOG_TOKEN", "IDENTITY_TO_ENGAGEMENT_TOKEN", "IDENTITY_TO_PAYMENTS_TOKEN",
    "INTERNAL_CALL_TIMEOUT_MS",
];

// Fresh module registry per load: the client reads INTERNAL_CALL_TIMEOUT_MS once, at require time.
const loadClient = () => {
    jest.resetModules();
    const { createInternalClient } = require("@leapmentor/shared/utils/internalClient");
    const client = require("../../../src/clients/engagement.client");
    return { client, createInternalClient, config: createInternalClient.mock.calls[0]?.[0] };
};

describe("Engagement Internal Client (Unit)", () => {
    let savedEnv;

    beforeEach(() => {
        savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
        ENV_KEYS.forEach((k) => delete process.env[k]);
    });

    afterEach(() => {
        ENV_KEYS.forEach((k) => {
            if (savedEnv[k] === undefined) delete process.env[k];
            else process.env[k] = savedEnv[k];
        });
    });

    it("should build exactly one internal client, identifying identity as the caller and engagement as the target", () => {
        const { createInternalClient, config } = loadClient();

        expect(createInternalClient).toHaveBeenCalledTimes(1);
        expect(config.caller).toBe("identity");
        expect(config.target).toBe("engagement");
    });

    it("should export the client returned by createInternalClient", () => {
        const { client } = loadClient();

        expect(client).toEqual({ marker: "engagement-client" });
    });

    it("should read the base URL from ENGAGEMENT_SERVICE_URL at call time, not at load time", () => {
        const { config } = loadClient();
        expect(config.baseUrl()).toBeUndefined();

        process.env.ENGAGEMENT_SERVICE_URL = "http://engagement.internal:7000";
        expect(config.baseUrl()).toBe("http://engagement.internal:7000");

        process.env.ENGAGEMENT_SERVICE_URL = "http://moved.internal:9000";
        expect(config.baseUrl()).toBe("http://moved.internal:9000");
    });

    it("should read the service token from IDENTITY_TO_ENGAGEMENT_TOKEN at call time", () => {
        const { config } = loadClient();
        expect(config.token()).toBeUndefined();

        process.env.IDENTITY_TO_ENGAGEMENT_TOKEN = "token-one";
        expect(config.token()).toBe("token-one");

        process.env.IDENTITY_TO_ENGAGEMENT_TOKEN = "token-two";
        expect(config.token()).toBe("token-two");
    });

    it("should only use its own service's URL and token, never another service's", () => {
        process.env.CATALOG_SERVICE_URL = "http://catalog";
        process.env.ENGAGEMENT_SERVICE_URL = "http://engagement";
        process.env.PAYMENTS_SERVICE_URL = "http://payments";
        process.env.IDENTITY_TO_CATALOG_TOKEN = "catalog-token";
        process.env.IDENTITY_TO_ENGAGEMENT_TOKEN = "engagement-token";
        process.env.IDENTITY_TO_PAYMENTS_TOKEN = "payments-token";

        const { config } = loadClient();

        expect(config.baseUrl()).toBe(process.env.ENGAGEMENT_SERVICE_URL);
        expect(config.token()).toBe(process.env.IDENTITY_TO_ENGAGEMENT_TOKEN);
    });

    it("should default the timeout to 3000ms when INTERNAL_CALL_TIMEOUT_MS is not set", () => {
        const { config } = loadClient();

        expect(config.timeoutMs).toBe(3000);
    });

    it("should use INTERNAL_CALL_TIMEOUT_MS when it is a valid number", () => {
        process.env.INTERNAL_CALL_TIMEOUT_MS = "7500";

        const { config } = loadClient();

        expect(config.timeoutMs).toBe(7500);
    });

    it.each(["abc", "", "0"])("should fall back to 3000ms when INTERNAL_CALL_TIMEOUT_MS is %p", (value) => {
        process.env.INTERNAL_CALL_TIMEOUT_MS = value;

        const { config } = loadClient();

        expect(config.timeoutMs).toBe(3000);
    });
});
