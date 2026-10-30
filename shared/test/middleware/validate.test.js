const Joi = require("joi");
const { mockRes, mockReq } = require("../helpers");

jest.mock("../../utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const logger = require("../../utils/logger");
const validate = require("../../middleware/validate");

const schema = Joi.object({
    email: Joi.string().email().required(),
    age: Joi.number().integer().min(18).required(),
    profile: Joi.object({ city: Joi.string().required() }),
});

const run = (mw, req) => {
    const res = mockRes();
    const next = jest.fn();
    mw(req, res, next);
    return { res, next };
};

describe("validate", () => {
    test("calls next() and replaces req.body with the validated (coerced) value", () => {
        const req = mockReq({ body: { email: "a@b.com", age: "21" } });
        const { next, res } = run(validate(schema), req);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
        expect(req.body).toEqual({ email: "a@b.com", age: 21 }); // "21" -> 21
    });

    test("strips unknown fields (e.g. a client trying to set isAdmin)", () => {
        const req = mockReq({ body: { email: "a@b.com", age: 30, isAdmin: true, role: "admin" } });
        run(validate(schema), req);
        expect(req.body).toEqual({ email: "a@b.com", age: 30 });
    });

    test("400 with every field error at once (abortEarly: false)", () => {
        const { res, next } = run(validate(schema), mockReq({ body: { email: "nope", age: 5 } }));
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        const { success, errors } = res.json.mock.calls[0][0];
        expect(success).toBe(false);
        expect(errors.map((e) => e.field).sort()).toEqual(["age", "email"]);
    });

    test("error messages have the quote characters removed", () => {
        const { res } = run(validate(schema), mockReq({ body: { age: 30 } }));
        const [{ errors }] = res.json.mock.calls[0];
        expect(errors).toEqual([{ field: "email", message: "email is required" }]);
    });

    test("nested field paths are dot-joined", () => {
        const { res } = run(validate(schema), mockReq({ body: { email: "a@b.com", age: 30, profile: {} } }));
        const [{ errors }] = res.json.mock.calls[0];
        expect(errors).toEqual([{ field: "profile.city", message: "profile.city is required" }]);
    });

    // KNOWN GAP (see report): Joi accepts `undefined` for an object schema, and Express 5 leaves
    // req.body undefined when no body parser matched (e.g. a POST without a JSON Content-Type).
    // validate() then calls next() with no validation at all, and controllers that destructure
    // req.body hit a TypeError. Remove `.failing` once validate() does `schema.validate(req[source] ?? {})`.
    test.failing("a request with no body at all still fails required-field validation", () => {
        const { res, next } = run(validate(schema), mockReq({ body: undefined }));
        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });

    test("can validate another request part (e.g. query) and leaves the body alone", () => {
        const q = Joi.object({ page: Joi.number().integer().min(1).default(1) });
        const req = mockReq({ body: { keep: "me" }, query: { page: "3", junk: "x" } });
        const { next } = run(validate(q, "query"), req);
        expect(next).toHaveBeenCalled();
        expect(req.query).toEqual({ page: 3 });
        expect(req.body).toEqual({ keep: "me" });
    });

    test("applies schema defaults", () => {
        const q = Joi.object({ page: Joi.number().default(1) });
        const req = mockReq({ query: {} });
        run(validate(q, "query"), req);
        expect(req.query).toEqual({ page: 1 });
    });

    test("logs a warning on failure but never logs the submitted values", () => {
        run(validate(schema), mockReq({ body: { email: "secret@leak.com", age: 5 }, path: "/register", method: "POST" }));
        expect(logger.warn).toHaveBeenCalledWith("Validation failed", expect.objectContaining({ path: "/register", method: "POST" }));
        expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("secret@leak.com");
    });
});
