const createAdminService = require("../src/services/admin.service");

const quiet = { info() { }, warn() { }, error() { }, debug() { } };

const build = ({ user = { name: "Alex", email: "alex@test.com" }, pending = [] } = {}) => {
    const order = [];
    const track = (name, ret) => async (...args) => { order.push(name); return typeof ret === "function" ? ret(...args) : ret; };
    const repo = {
        findUserByIdRaw: track("repo.findUserByIdRaw", user),
        deleteUserById: track("repo.deleteUserById", {}),
        softDeleteUserById: track("repo.softDeleteUserById", {}),
        blockUserById: track("repo.blockUserById", user),
        unblockUserById: track("repo.unblockUserById", user),
    };
    const refreshTokenRepo = { deleteAllByUserId: track("tokens.deleteAll", {}) };
    const done = (name) => track(`cascade.${name}`, { operationId: "op", completed: [], pending });
    const userCascade = { hardDelete: done("hardDelete"), softDelete: done("softDelete"), restore: done("restore") };
    const service = createAdminService(repo, { logger: quiet, refreshTokenRepo, userCascade });
    return { service, repo, order };
};

test("removeUser deletes the local user first, then asks the other services", async () => {
    const { service, order } = build();
    const res = await service.removeUser("u1");
    expect(order).toEqual(["repo.findUserByIdRaw", "repo.deleteUserById", "cascade.hardDelete"]);
    expect(res.message).toMatch(/permanently deleted/);
    expect(res.pendingCleanup).toEqual([]);
});

test("removeUser reports cleanup that is still queued", async () => {
    const { service } = build({ pending: ["engagement.hardDelete"] });
    const res = await service.removeUser("u1");
    expect(res.pendingCleanup).toEqual(["engagement.hardDelete"]);
});

test("removeUser on an unknown user is a 404 and starts no cascade", async () => {
    const { service, order } = build({ user: null });
    await expect(service.removeUser("u1")).rejects.toHaveProperty("status", 404);
    expect(order).toEqual(["repo.findUserByIdRaw"]);
});

test("deleteUser soft-deletes locally, revokes tokens, then cascades", async () => {
    const { service, order } = build();
    const res = await service.deleteUser("u1");
    expect(order).toEqual(["repo.findUserByIdRaw", "repo.softDeleteUserById", "tokens.deleteAll", "cascade.softDelete"]);
    expect(res.message).toMatch(/has been deleted/);
});

test("deleteUser on an unknown user is a 404 and starts no cascade", async () => {
    const { service, order } = build({ user: null });
    await expect(service.deleteUser("u1")).rejects.toHaveProperty("status", 404);
    expect(order.includes("cascade.softDelete")).toBe(false);
});

test("unblockUser restores the user, then asks the other services to restore", async () => {
    const { service, order } = build();
    const res = await service.unblockUser("u1");
    expect(order).toEqual(["repo.unblockUserById", "cascade.restore"]);
    expect(res.message).toMatch(/restored/);
});

test("unblockUser on an unknown user is a 404 and starts no cascade", async () => {
    const { service, order } = build({ user: null });
    await expect(service.unblockUser("u1")).rejects.toHaveProperty("status", 404);
    expect(order.includes("cascade.restore")).toBe(false);
});

test("blockUser stays inside identity and calls no other service", async () => {
    const { service, order } = build();
    await service.blockUser("u1");
    expect(order).toEqual(["repo.blockUserById", "tokens.deleteAll"]);
});