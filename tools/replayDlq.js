#!/usr/bin/env node
// Re-queues dead-lettered stream messages after the cause has been fixed.
//
//   cd services/identity-service
//   node ../../tools/replayDlq.js stream:user-cascade --dry-run
//   node ../../tools/replayDlq.js stream:user-cascade --limit 10
//   node ../../tools/replayDlq.js stream:user-cascade --id 1730000000000-0
//
// Each message is put back on its original stream and removed from the DLQ in one
// MULTI, so it cannot be lost or duplicated by a crash half-way through.
require("dotenv").config();
const { createClient } = require("@leapmentor/shared/utils/streams");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const stream = args.find((a, i) => !a.startsWith("--") && !["--limit", "--id"].includes(args[i - 1]));

if (!stream) {
    console.error("Usage: node tools/replayDlq.js <stream> [--dry-run] [--limit N] [--id <dlq-entry-id>]");
    process.exit(1);
}

const toObject = (flat = []) => {
    const out = {};
    for (let i = 0; i < flat.length; i += 2) out[flat[i]] = flat[i + 1];
    return out;
};

(async () => {
    const redis = createClient();
    const dlq = `${stream}:dlq`;
    const id = option("--id");
    const limit = Number(option("--limit") || 100);
    const dryRun = flag("--dry-run");

    const rows = id ? await redis.xrange(dlq, id, id) : await redis.xrange(dlq, "-", "+", "COUNT", String(limit));
    console.log(`${rows.length} dead-lettered message(s) in ${dlq}${dryRun ? " (dry run)" : ""}`);

    for (const [dlqId, flat] of rows) {
        const f = toObject(flat);
        const failedAt = f.failedAt ? new Date(Number(f.failedAt)).toISOString() : "unknown";
        console.log(`${dlqId}  type=${f.type}  key=${f.key || "-"}  failedAt=${failedAt}  error=${f.error}`);
        if (dryRun) continue;

        const fields = ["type", f.type, "payload", f.payload, "key", f.key || "", "ts", String(Date.now())];
        await redis.multi().xadd(stream, "*", ...fields).xdel(dlq, dlqId).exec();
        if (f.key && f.group) await redis.del(`streams:done:${stream}:${f.group}:${f.key}`);
    }

    await redis.quit();
})().catch((err) => { console.error(err.message); process.exit(1); });