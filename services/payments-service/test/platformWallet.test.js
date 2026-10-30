const fs = require("node:fs");
const path = require("node:path");
const { createInternalEscrowService } = require("../src/services/internalEscrow.service");
const createAdminPaymentsService = require("../src/services/adminPayments.service");
const { migrate } = require("../src/scripts/migratePlatformWallet");

const quiet = { info() { }, warn() { }, error() { }, debug() { } };
const SRC = path.join(__dirname, "..", "src");
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".js") ? [path.join(dir, e.name)] : []);

// ---------- release credits the platform wallet
const makeReleaseFixture = ({ adminExists = true } = {}) => {
    const mentee = "e".repeat(24);
    const mentor = "f".repeat(24);
    const escrow = {
        mentee, mentor, status: "held", sessionCount: 1,
        totalAmount: 105, commissionAmount: 5, mentorPayout: 100, commissionRate: 5,
        refunds: [], operations: [],
        slots: [{ slotIndex: 0, status: "held", totalAmount: 105, commissionAmount: 5, mentorPayout: 100 }],
    };
    const wallets = { [mentee]: { balance: 0, escrow: 105 }, [mentor]: { balance: 0, escrow: 0 } };
    const calls = [];
    const repo = {
        findEscrow: async () => escrow,
        findWallet: async (id) => wallets[String(id)],
        saveWallet: async () => { },
        saveEscrow: async () => { },
        insertTransactions: async (docs) => { calls.push(["insertTransactions", docs.length]); },
        findActiveAdmin: async () => { calls.push(["findActiveAdmin"]); return adminExists ? { _id: "admin1" } : null; },
        creditAdmin: async () => { calls.push(["creditAdmin"]); },
        creditPlatformWallet: async (amount) => { calls.push(["creditPlatformWallet", amount]); },
    };
    const svc = createInternalEscrowService(repo, { transaction: async (fn) => fn("session"), logger: quiet });
    return { svc, calls, wallets, mentee, mentor };
};

test("releasing an escrow credits the commission to the platform wallet", async () => {
    const { svc, calls, wallets, mentor } = makeReleaseFixture();
    const result = await svc.release({ requestId: "r".repeat(24) });
    expect(result.commissionAmount).toBe(5);
    expect(calls.filter(([name]) => name === "creditPlatformWallet")).toEqual([["creditPlatformWallet", 5]]);
    expect(wallets[mentor].balance).toBe(100);
});

test("release no longer touches AdminUser, and works even with no admin account", async () => {
    const { svc, calls } = makeReleaseFixture({ adminExists: false });
    await svc.release({ requestId: "r".repeat(24) });
    const names = calls.map(([name]) => name);
    expect(names.includes("creditAdmin")).toBe(false);
    expect(names.includes("findActiveAdmin")).toBe(false);
    expect(names.includes("creditPlatformWallet")).toBe(true);
});

test("repeating a release does not credit the platform wallet twice", async () => {
    const { svc, calls } = makeReleaseFixture();
    await svc.release({ requestId: "r".repeat(24) });
    await svc.release({ requestId: "r".repeat(24) });
    expect(calls.filter(([name]) => name === "creditPlatformWallet")).toHaveLength(1);
});

// ---------- repository
const loadRepoWithFakes = () => {
    const calls = [];
    const fake = (name) => new Proxy(function () { }, {
        get: (_t, prop) => {
            if (typeof prop === "symbol" || prop === "__esModule" || prop === "then") return undefined;
            if (prop === "PLATFORM_KEY") return "platform";
            return (...args) => { calls.push({ model: name, method: prop, args }); return { select: () => ({ session: () => null }), session: () => null }; };
        },
    });

    let repo;
    jest.isolateModules(() => {
        for (const name of ["Escrow", "Wallet", "Transaction", "AdminUser", "WalletOperation", "PlatformWallet"]) {
            jest.doMock(`@leapmentor/shared/models/${name}`, () => fake(name));
        }
        jest.doMock("../src/utils/wallet", () => ({ getOrCreateWallet: async () => null }));
        repo = require("../src/repositories/internalEscrow.repository");
    });
    return { repo, calls };
};

test("creditPlatformWallet increments the platform wallet and upserts it", () => {
    const { repo, calls } = loadRepoWithFakes();
    repo.creditPlatformWallet(7, "sess");
    expect(calls).toEqual([{
        model: "PlatformWallet", method: "findOneAndUpdate",
        args: [{ key: "platform" }, { $inc: { balance: 7 } }, { returnDocument: "after", upsert: true, session: "sess" }],
    }]);
});

// ---------- boundary
test("payments never writes AdminUser", () => {
    const offenders = [];
    for (const file of walk(SRC)) {
        const code = fs.readFileSync(file, "utf8");
        if (/\bAdminUser\.(create|insertMany|update\w*|findOneAndUpdate|findByIdAndUpdate|delete\w*|findOneAndDelete|bulkWrite|save)\(/.test(code)) {
            offenders.push(path.relative(SRC, file));
        }
        if (/\$inc:\s*\{\s*walletBalance/.test(code)) offenders.push(`${path.relative(SRC, file)} ($inc walletBalance)`);
    }
    expect(offenders).toEqual([]);
});

test("the shared escrow repository no longer exports creditAdmin or selects walletBalance", () => {
    const code = fs.readFileSync(path.join(__dirname, "..", "src", "repositories", "escrow.repository.js"), "utf8");
    expect(code.includes("creditAdmin")).toBe(false);
    expect(code.includes("walletBalance")).toBe(false);
});

test("the identity admin DTO no longer exposes a stale walletBalance", () => {
    const code = fs.readFileSync(path.join(__dirname, "..", "..", "..", "shared", "utils", "mappers", "adminUser.mapper.js"), "utf8");
    expect(code.includes("walletBalance")).toBe(false);
});

// ---------- dashboard read
test("payment stats include the platform balance", async () => {
    const repo = {
        findAdminCommissionRate: async () => ({ commissionRate: 10 }),
        findCompletedPaidSessions: async () => [{ totalAmount: 100, commissionAmount: 10 }],
        sumAllWalletEscrows: async () => [{ total: 50 }],
        countRefundedRequests: async () => 1,
        findPlatformBalance: async () => ({ balance: 42.5 }),
    };
    const stats = await createAdminPaymentsService(repo, { _logger: quiet }).fetchPaymentStats("a1");
    expect(stats.platformBalance).toBe(42.5);
    expect(stats.platformCommission).toBe(10);
});

test("platform balance is 0 before the first commission", async () => {
    const repo = {
        findAdminCommissionRate: async () => null,
        findCompletedPaidSessions: async () => [],
        sumAllWalletEscrows: async () => [],
        countRefundedRequests: async () => 0,
        findPlatformBalance: async () => null,
    };
    const stats = await createAdminPaymentsService(repo, { _logger: quiet }).fetchPaymentStats("a1");
    expect(stats.platformBalance).toBe(0);
});

// ---------- migration
const makeMigrationFakes = ({ adminTotal, existing = null, duplicateOnUpsert = false }) => {
    const state = { doc: existing ? { ...existing } : null, writes: 0 };
    const AdminUser = { aggregate: async () => (adminTotal === null ? [] : [{ _id: null, total: adminTotal }]) };
    const PlatformWallet = {
        PLATFORM_KEY: "platform",
        findOne: () => ({ lean: async () => (state.doc ? { ...state.doc } : null) }),
        updateOne: async (filter, update, opts) => {
            if (opts?.upsert) {
                if (duplicateOnUpsert) { const e = new Error("E11000"); e.code = 11000; throw e; }
                if (!state.doc) state.doc = { key: "platform", balance: 0, migratedFromAdminAt: null };
                return { modifiedCount: 0 };
            }
            if (!state.doc || state.doc.migratedFromAdminAt) return { modifiedCount: 0 };
            state.writes += 1;
            state.doc.balance += update.$inc.balance;
            state.doc.openingBalance = update.$set.openingBalance;
            state.doc.migratedFromAdminAt = update.$set.migratedFromAdminAt;
            return { modifiedCount: 1 };
        },
    };
    return { state, AdminUser, PlatformWallet };
};

test("migration dry run reports the total and writes nothing", async () => {
    const f = makeMigrationFakes({ adminTotal: 1250.5 });
    const out = await migrate({ ...f, apply: false, logger: quiet });
    expect(out).toEqual({ status: "dry-run", copied: 1250.5, balance: 1250.5 });
    expect(f.state.doc).toBeNull();
});

test("migration --apply copies the admin total into the platform wallet once", async () => {
    const f = makeMigrationFakes({ adminTotal: 300 });
    const out = await migrate({ ...f, apply: true, logger: quiet });
    expect(out).toEqual({ status: "migrated", copied: 300, balance: 300 });
    expect(f.state.doc.openingBalance).toBe(300);
    expect(f.state.doc.migratedFromAdminAt).toBeInstanceOf(Date);
});

test("running the migration twice does not double the balance", async () => {
    const f = makeMigrationFakes({ adminTotal: 300 });
    await migrate({ ...f, apply: true, logger: quiet });
    const second = await migrate({ ...f, apply: true, logger: quiet });
    expect(second.status).toBe("already-migrated");
    expect(f.state.doc.balance).toBe(300);
    expect(f.state.writes).toBe(1);
});

test("commissions credited before the migration are kept on top of the copied total", async () => {
    const f = makeMigrationFakes({ adminTotal: 300, existing: { key: "platform", balance: 20, migratedFromAdminAt: null } });
    const out = await migrate({ ...f, apply: true, logger: quiet });
    expect(out.balance).toBe(320);
});

test("migration tolerates losing the create race to a concurrent credit", async () => {
    const f = makeMigrationFakes({ adminTotal: 10, existing: { key: "platform", balance: 5, migratedFromAdminAt: null }, duplicateOnUpsert: true });
    const out = await migrate({ ...f, apply: true, logger: quiet });
    expect(out.status).toBe("migrated");
    expect(out.balance).toBe(15);
});

test("migration with no admin balances copies zero", async () => {
    const f = makeMigrationFakes({ adminTotal: null });
    const out = await migrate({ ...f, apply: true, logger: quiet });
    expect(out).toEqual({ status: "migrated", copied: 0, balance: 0 });
});