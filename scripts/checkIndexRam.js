/**
 * Run with: node scripts/checkIndexRam.js
 * Checks total index size vs available RAM and prints per-collection breakdown.
 */

const mongoose = require("mongoose");
require("dotenv").config();

const RAM_MB = 512; // Render free tier
const WARN_AT = 0.8;

async function run() {
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is not defined in environment variables");
    }

    await mongoose.connect(process.env.MONGO_URI);

    const db = mongoose.connection.db;

    // Prefer modern dbStats command
    const dbStats = await db.command({ dbStats: 1 });

    const totalIndexBytes = dbStats.indexSize || 0;
    const totalMB = (totalIndexBytes / 1024 / 1024).toFixed(2);

    const ratio = totalIndexBytes / (RAM_MB * 1024 * 1024);

    console.log(`\nTotal index size : ${totalMB} MB`);
    console.log(`RAM limit        : ${RAM_MB} MB`);
    console.log(`Usage            : ${(ratio * 100).toFixed(1)}%`);
    console.log(
        ratio > WARN_AT
            ? "⚠️  OVER 80% — drop unused indexes"
            : "✅ Within safe range"
    );

    console.log("\nPer collection:");

    const cols = await db.listCollections().toArray();

    for (const col of cols) {
        try {
            const stats = await db.command({ collStats: col.name });

            const indexBytes = stats.totalIndexSize || 0;
            const mb = (indexBytes / 1024 / 1024).toFixed(3);

            console.log(
                `  ${col.name.padEnd(30)} ${mb} MB  (${stats.nindexes || 0} indexes)`
            );
        } catch (err) {
            console.error(`  ${col.name.padEnd(30)} ERROR fetching stats`, err.message);
        }
    }

    await mongoose.disconnect();
}

run().catch((e) => {
    console.error("Script failed:", e);
    process.exit(1);
});