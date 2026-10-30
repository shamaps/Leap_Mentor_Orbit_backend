/**
 * @fileoverview Tests for the ServiceCompensation model: validation, defaults and indexes.
 * No database needed. Validation runs on the schema only.
 */

const fs = require("node:fs");
const path = require("node:path");
const ServiceCompensation = require("../../../src/models/ServiceCompensation");

const valid = (overrides = {}) => ({
    key: "payments:release:r1",
    action: "payments.release",
    payload: { requestId: "r1" },
    ...overrides,
});

describe("ServiceCompensation Model", () => {
    it("should accept a minimal record", () => {
        expect(new ServiceCompensation(valid()).validateSync()).toBeUndefined();
    });

    it("should start out pending with no attempts, no lease, no error and no result", () => {
        const doc = new ServiceCompensation(valid());

        expect(doc).toMatchObject({ status: "pending", attempts: 0, leaseUntil: null, lastError: "", result: null, completedAt: null, failedAt: null });
        expect(doc.nextAttemptAt).toBeInstanceOf(Date);
    });

    it.each(["key", "action", "payload"])("should require %s", (field) => {
        const input = valid();
        delete input[field];

        const error = new ServiceCompensation(input).validateSync();

        expect(error.errors[field]).toBeDefined();
    });

    it("should reject an action that is not a known operation", () => {
        const error = new ServiceCompensation(valid({ action: "payments.steal" })).validateSync();
        expect(error.errors.action).toBeDefined();
    });

    it("should reject a status outside the four lifecycle states", () => {
        const error = new ServiceCompensation(valid({ status: "stuck" })).validateSync();
        expect(error.errors.status).toBeDefined();
    });

    it.each(["pending", "processing", "completed", "failed"])("should accept the %s status", (status) => {
        expect(new ServiceCompensation(valid({ status })).validateSync()).toBeUndefined();
    });

    it("should keep empty objects in the payload instead of dropping them", () => {
        const doc = new ServiceCompensation(valid({ payload: { nested: {} } }));
        expect(doc.payload).toEqual({ nested: {} });
        expect(ServiceCompensation.schema.options.minimize).toBe(false);
    });

    it("should record created and updated times", () => {
        expect(ServiceCompensation.schema.options.timestamps).toBe(true);
    });

    it("should make the key unique so a retried request cannot enqueue the same work twice", () => {
        expect(ServiceCompensation.schema.path("key").options.unique).toBe(true);
    });

    it("should have an index that serves the 'next due record' query", () => {
        const indexes = ServiceCompensation.schema.indexes().map(([fields]) => fields);
        expect(indexes).toContainEqual({ status: 1, nextAttemptAt: 1, createdAt: 1 });
    });

    it("should list every action the compensation runner can perform (no drift)", () => {
        const source = fs.readFileSync(path.join(__dirname, "../../../src/services/serviceCompensation.service.js"), "utf8");
        const handled = [...source.matchAll(/case "([a-zA-Z]+\.[a-zA-Z]+)":/g)].map((m) => m[1]).sort();
        const allowed = [...ServiceCompensation.schema.path("action").enumValues].sort();

        expect(handled.length).toBeGreaterThan(0);
        expect(allowed).toEqual(handled);
    });
});
