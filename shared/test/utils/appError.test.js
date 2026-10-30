const { mockRes } = require("../helpers");

jest.mock("../../utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const logger = require("../../utils/logger");
const AppError = require("../../utils/appError");
const { handleError } = AppError;

describe("AppError", () => {
    test("carries status, message and meta, and is an operational Error", () => {
        const err = new AppError(404, "Not here", { resource: "session" });
        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(AppError);
        expect(err.name).toBe("AppError");
        expect(err.status).toBe(404);
        expect(err.message).toBe("Not here");
        expect(err.meta).toEqual({ resource: "session" });
        expect(err.isOperational).toBe(true);
        expect(err.stack).toEqual(expect.any(String));
    });

    test("meta defaults to {}", () => {
        expect(new AppError(400, "x").meta).toEqual({});
    });
});

describe("handleError", () => {
    test("Mongoose ValidationError -> 400 with a field/message list", () => {
        const res = mockRes();
        const err = Object.assign(new Error("invalid"), {
            name: "ValidationError",
            errors: {
                email: { path: "email", message: "Invalid email format" },
                name: { path: "name", message: "Name is required" },
            },
        });
        handleError(res, err, "register");
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            errors: [
                { field: "email", message: "Invalid email format" },
                { field: "name", message: "Name is required" },
            ],
        });
        expect(logger.warn).toHaveBeenCalledWith("[register] validation error", expect.any(Object));
    });

    test("duplicate key (11000) -> 409 naming the field", () => {
        const res = mockRes();
        handleError(res, Object.assign(new Error("dup"), { code: 11000, keyValue: { email: "a@b.com" } }), "register");
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: "email already exists" });
    });

    test("duplicate key without keyValue falls back to a generic field name", () => {
        const res = mockRes();
        handleError(res, Object.assign(new Error("dup"), { code: 11000 }), "ctx");
        expect(res.json).toHaveBeenCalledWith({ success: false, message: "field already exists" });
    });

    test("AppError -> its own status, message and meta", () => {
        const res = mockRes();
        handleError(res, new AppError(403, "Forbidden", { upstream: "payments" }), "ctx");
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: "Forbidden", upstream: "payments" });
        expect(logger.warn).toHaveBeenCalledWith("[ctx] rejected", expect.objectContaining({ status: 403, reason: "Forbidden" }));
    });

    test("AppError 422 adds the UNPROCESSABLE code", () => {
        const res = mockRes();
        handleError(res, new AppError(422, "Slot already booked"), "ctx");
        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: "Slot already booked", code: "UNPROCESSABLE" });
    });

    test("unknown errors -> 500 with a generic message (internals are not leaked) and an error log", () => {
        const res = mockRes();
        handleError(res, new Error("connection string mongodb://user:pw@host"), "ctx");
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: "Internal server error" });
        expect(JSON.stringify(res.json.mock.calls)).not.toMatch(/mongodb:/);
        expect(logger.error).toHaveBeenCalledWith("[ctx] unexpected error", expect.objectContaining({ error: expect.any(String) }));
    });

    test("context defaults to 'unknown'", () => {
        handleError(mockRes(), new Error("x"));
        expect(logger.error).toHaveBeenCalledWith("[unknown] unexpected error", expect.any(Object));
    });
});
