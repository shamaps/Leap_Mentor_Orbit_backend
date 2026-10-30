const { mockRes, mockReq } = require("../helpers");

jest.mock("../../utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const logger = require("../../utils/logger");
const { requireInternalAuth, tokenEnvName } = require("../../middleware/internalAuth");

const ENV = "ENGAGEMENT_TO_PAYMENTS_TOKEN";
const SECRET = "s3cret-value";

beforeEach(() => { process.env[ENV] = SECRET; });
afterEach(() => { delete process.env[ENV]; delete process.env.MY_SVC_TO_THE_SERVICE_TOKEN; });

const run = (headers, opts = { service: "payments", callers: ["engagement"] }) => {
    const mw = requireInternalAuth(opts);
    const req = mockReq({ headers });
    const res = mockRes();
    const next = jest.fn();
    mw(req, res, next);
    return { req, res, next };
};

describe("tokenEnvName", () => {
    test("is CALLER_TO_SERVICE_TOKEN, upper-cased", () => {
        expect(tokenEnvName("engagement", "payments")).toBe("ENGAGEMENT_TO_PAYMENTS_TOKEN");
    });

    test("replaces characters that are not valid in env var names", () => {
        expect(tokenEnvName("my-svc", "the.service")).toBe("MY_SVC_TO_THE_SERVICE_TOKEN");
    });
});

describe("requireInternalAuth", () => {
    test("accepts a listed caller with the right token and records who called", () => {
        const { req, res, next } = run({ "x-caller-service": "engagement", "x-internal-token": SECRET });
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
        expect(req.internalCaller).toBe("engagement");
    });

    test("caller matching is case-insensitive", () => {
        const { req, next } = run({ "x-caller-service": "EngagEment", "x-internal-token": SECRET });
        expect(next).toHaveBeenCalled();
        expect(req.internalCaller).toBe("engagement");
    });

    test("callers in the options are normalised to lower-case too", () => {
        const { next } = run(
            { "x-caller-service": "engagement", "x-internal-token": SECRET },
            { service: "payments", callers: ["ENGAGEMENT"] });
        expect(next).toHaveBeenCalled();
    });

    test.each([
        ["no headers", {}],
        ["unknown caller", { "x-caller-service": "catalog", "x-internal-token": SECRET }],
        ["empty caller", { "x-caller-service": "", "x-internal-token": SECRET }],
    ])("401 when the caller is not allowed (%s)", (_n, headers) => {
        const { res, next } = run(headers);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: "Invalid internal credentials" });
        expect(next).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith("Rejected internal call: caller not allowed", expect.any(Object));
    });

    test("a caller that is allowed on a different route set is still rejected here", () => {
        process.env.CATALOG_TO_PAYMENTS_TOKEN = "x";
        try {
            const { res } = run({ "x-caller-service": "catalog", "x-internal-token": "x" });
            expect(res.status).toHaveBeenCalledWith(401);
        } finally {
            delete process.env.CATALOG_TO_PAYMENTS_TOKEN;
        }
    });

    test("401 on a wrong token, without ever echoing the expected one", () => {
        const { res, next } = run({ "x-caller-service": "engagement", "x-internal-token": "wrong" });
        expect(res.status).toHaveBeenCalledWith(401);
        expect(JSON.stringify(res.json.mock.calls)).not.toContain(SECRET);
        expect(next).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith("Rejected internal call: bad token", expect.any(Object));
    });

    test("401 when the token header is missing", () => {
        const { res } = run({ "x-caller-service": "engagement" });
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test("a token that is a different length (or a prefix of the secret) is rejected without throwing", () => {
        for (const given of ["s", SECRET.slice(0, -1), `${SECRET}x`, ""]) {
            const { res, next } = run({ "x-caller-service": "engagement", "x-internal-token": given });
            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        }
    });

    test("fails closed with 503 when no secret is configured for that caller", () => {
        delete process.env[ENV];
        const { res, next } = run({ "x-caller-service": "engagement", "x-internal-token": "anything" });
        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: "Internal service authentication is not configured" });
        expect(next).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(
            "Internal auth is not configured for caller", expect.objectContaining({ envVar: ENV }));
    });

    test("an empty-string secret counts as not configured (cannot be matched by an empty token)", () => {
        process.env[ENV] = "";
        const { res, next } = run({ "x-caller-service": "engagement", "x-internal-token": "" });
        expect(res.status).toHaveBeenCalledWith(503);
        expect(next).not.toHaveBeenCalled();
    });

    test("each caller has its own secret", () => {
        process.env.IDENTITY_TO_PAYMENTS_TOKEN = "identity-secret";
        try {
            const opts = { service: "payments", callers: ["engagement", "identity"] };
            expect(run({ "x-caller-service": "identity", "x-internal-token": "identity-secret" }, opts).next).toHaveBeenCalled();
            expect(run({ "x-caller-service": "identity", "x-internal-token": SECRET }, opts).next).not.toHaveBeenCalled();
        } finally {
            delete process.env.IDENTITY_TO_PAYMENTS_TOKEN;
        }
    });
});
