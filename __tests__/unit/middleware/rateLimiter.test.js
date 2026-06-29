// Mock ioredis completely to isolate memory stores away from network sockets components 
jest.mock("ioredis", () => {
    return jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        call: jest.fn(),
    }));
});

jest.mock("express-rate-limit", () => ({
    rateLimit: jest.fn((options) => (req, res, next) => next()),
    ipKeyGenerator: jest.fn(() => "127.0.0.1"),
}));

jest.mock("rate-limit-redis", () => ({
    RedisStore: jest.fn(),
}));

describe("Redis-Backed Rate Limiting Interfaces (Unit)", () => {
    it("should successfully initialize limiters structures mapping standard configurations parameters hooks", () => {
        const limiters = require("../../../middleware/rateLimiter");

        expect(limiters.globalLimiter).toBeDefined();
        expect(limiters.loginLimiter).toBeDefined();
        expect(limiters.aiLimiter).toBeDefined();
    });
});