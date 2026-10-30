const { mockRes } = require("../helpers");
const { ok, created, fail, noContent, unprocessable } = require("../../utils/response");

describe("response helpers", () => {
    test("ok -> 200 { success, data }", () => {
        const res = mockRes();
        ok(res, { a: 1 });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ success: true, data: { a: 1 } });
    });

    test("ok accepts a custom status and defaults data to {}", () => {
        const res = mockRes();
        ok(res, undefined, 202);
        expect(res.status).toHaveBeenCalledWith(202);
        expect(res.json).toHaveBeenCalledWith({ success: true, data: {} });
    });

    test("created -> 201", () => {
        const res = mockRes();
        created(res, { id: "1" });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: "1" } });
    });

    test("fail -> 400 by default, custom status allowed", () => {
        const res = mockRes();
        fail(res, "Nope");
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: "Nope" });

        const res2 = mockRes();
        fail(res2, "Missing", 404);
        expect(res2.status).toHaveBeenCalledWith(404);
    });

    test("noContent -> 204 with an empty body", () => {
        const res = mockRes();
        noContent(res);
        expect(res.status).toHaveBeenCalledWith(204);
        expect(res.send).toHaveBeenCalledWith();
        expect(res.json).not.toHaveBeenCalled();
    });

    test("unprocessable -> 422 with the UNPROCESSABLE code and optional meta", () => {
        const res = mockRes();
        unprocessable(res, "Escrow already paid", { escrowId: "e1" });
        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.json).toHaveBeenCalledWith({
            success: false, message: "Escrow already paid", code: "UNPROCESSABLE", escrowId: "e1",
        });
    });
});
