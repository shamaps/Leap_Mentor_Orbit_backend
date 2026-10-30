const fs = require("node:fs");
const path = require("node:path");

const SRC = path.join(__dirname, "..", "src");
const FOREIGN = ["MentorProfile", "MenteeProfile", "ConnectRequest", "Wallet"];
const WRITES = "(create|insertMany|update\\w*|findOneAndUpdate|findByIdAndUpdate|findOneAndDelete|findByIdAndDelete|delete\\w*|bulkWrite|replaceOne|save)";

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".js") ? [path.join(dir, e.name)] : []);

test("no identity source file writes MentorProfile, MenteeProfile, ConnectRequest or Wallet", () => {
    const offenders = [];
    for (const file of walk(SRC)) {
        const code = fs.readFileSync(file, "utf8");
        for (const model of FOREIGN) {
            if (new RegExp(`\\b${model}\\.${WRITES}\\(`).test(code)) offenders.push(`${path.relative(SRC, file)} writes ${model}`);
        }
    }
    expect(offenders).toEqual([]);
});

test("the admin repository no longer imports Wallet or opens cross-service transactions", () => {
    const code = fs.readFileSync(path.join(SRC, "repositories", "admin.repository.js"), "utf8");
    expect(/models\/Wallet/.test(code)).toBe(false);
    expect(/withTransaction/.test(code)).toBe(false);
    for (const removed of ["hardDeleteUser", "cascadeDeleteUser"]) {
        expect(code.includes(removed)).toBe(false); // `${removed}` should be gone
    }
});

test("the admin repository deletes and soft-deletes only the User row", async () => {
    const calls = [];
    // Every model the repository imports is replaced by a recorder.
    const fakeModel = (name) => new Proxy({}, {
        get: (_t, method) => {
            if (typeof method === "symbol" || method === "__esModule" || method === "then") return undefined;
            return (...args) => { calls.push({ model: name, method, args }); return Promise.resolve({}); };
        },
    });

    let repo;
    jest.isolateModules(() => {
        for (const name of ["User", "AdminUser", "MentorProfile", "MenteeProfile", "ConnectRequest"]) {
            jest.doMock(`@leapmentor/shared/models/${name}`, () => fakeModel(name));
        }
        jest.doMock("../src/repositories/userSearch.repository", () => ({ findUsersByName: async () => [] }));
        repo = require("../src/repositories/admin.repository");
    });

    await repo.deleteUserById("u1");
    await repo.softDeleteUserById("u1");

    expect(calls.map((c) => `${c.model}.${c.method}`)).toEqual(["User.findByIdAndDelete", "User.findByIdAndUpdate"]);
    expect(calls[1].args[1].$set.isDeleted).toBe(true);
    expect(calls[1].args[1].$set.deletedAt).toBeInstanceOf(Date);
});