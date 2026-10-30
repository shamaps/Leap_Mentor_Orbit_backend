// Shared helpers for the shared/ test suite (not a test file itself).

/** Minimal Express-style response double: res.status(n).json(body) / .send() */
const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
};

/** Express-style request double with sane defaults. */
const mockReq = (overrides = {}) => ({
    headers: {},
    cookies: {},
    path: "/test",
    method: "GET",
    ip: "127.0.0.1",
    ...overrides,
});

/** Logger double with the same surface as utils/logger. */
const mockLog = () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() });

module.exports = { mockRes, mockReq, mockLog };
