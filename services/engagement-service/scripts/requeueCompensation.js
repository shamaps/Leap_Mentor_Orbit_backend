// Puts a failed ServiceCompensation record back in the retry queue after the
// cause has been fixed. Run it inside the engagement container:
//
//   docker exec engagement node scripts/requeueCompensation.js --list
//   docker exec engagement node scripts/requeueCompensation.js <key>
//
// Only records in the "failed" state are touched. Downstream calls are
// idempotent, so requeueing a record that partly ran is safe.
require("dotenv").config({
    path: require("node:path").join(__dirname, "..", ".env"),
});

const mongoose = require("mongoose");
const { connectDB } = require("@leapmentor/shared/config/database");
const ServiceCompensation = require("../src/models/ServiceCompensation");

const arg = process.argv[2];

if (!arg) {
    console.error("Usage: node scripts/requeueCompensation.js --list | <key>");
    process.exit(1);
}

(async () => {
    await connectDB();

    if (arg === "--list") {
        const rows = await ServiceCompensation.find({ status: "failed" })
            .sort({ failedAt: 1 })
            .lean();

        console.log(`${rows.length} failed compensation record(s)`);
        for (const r of rows) {
            console.log(
                `${r.key}\n  action=${r.action} failedAt=${r.failedAt?.toISOString()} attempts=${r.attempts}\n  lastError=${r.lastError}`
            );
        }
    } else {
        const res = await ServiceCompensation.updateOne(
            { key: arg, status: "failed" },
            {
                $set: {
                    status: "pending",
                    attempts: 0,
                    nextAttemptAt: new Date(),
                    leaseUntil: null,
                },
            }
        );
        console.log(
            res.modifiedCount
                ? `Requeued ${arg}`
                : `No failed record with key ${arg}`
        );
    }

    await mongoose.disconnect();
})().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
