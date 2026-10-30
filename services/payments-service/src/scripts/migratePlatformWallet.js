require("dotenv").config();
const mongoose = require("mongoose");

const round = (value) => Math.round(Number(value || 0) * 100) / 100;

const migrate = async ({ AdminUser, PlatformWallet, apply = false, logger = console }) => {
    const [aggregate] = await AdminUser.aggregate([
        { $group: { _id: null, total: { $sum: "$walletBalance" } } },
    ]);
    const total = round(aggregate?.total);

    const existing = await PlatformWallet.findOne({
        key: PlatformWallet.PLATFORM_KEY,
    }).lean();

    if (existing?.migratedFromAdminAt) {
        logger.info?.("Platform wallet already migrated; nothing to do", {
            balance: existing.balance,
        });
        return {
            status: "already-migrated",
            copied: 0,
            balance: existing.balance,
        };
    }

    if (!apply) {
        return {
            status: "dry-run",
            copied: total,
            balance: round(existing?.balance) + total,
        };
    }

    // A concurrent commission credit may create the wallet first;
    // duplicate key just means it exists.
    try {
        await PlatformWallet.updateOne(
            { key: PlatformWallet.PLATFORM_KEY },
            { $setOnInsert: { balance: 0 } },
            { upsert: true }
        );
    } catch (error) {
        if (error?.code !== 11000) throw error;
    }

    // Only the first run matches, so the old total is copied once.
    const result = await PlatformWallet.updateOne(
        {
            key: PlatformWallet.PLATFORM_KEY,
            migratedFromAdminAt: null,
        },
        {
            $inc: { balance: total },
            $set: {
                openingBalance: total,
                migratedFromAdminAt: new Date(),
            },
        }
    );

    const after = await PlatformWallet.findOne({
        key: PlatformWallet.PLATFORM_KEY,
    }).lean();

    if (!result.modifiedCount) {
        return {
            status: "already-migrated",
            copied: 0,
            balance: after?.balance ?? 0,
        };
    }

    return {
        status: "migrated",
        copied: total,
        balance: after?.balance ?? 0,
    };
};

const main = async () => {
    const { connectDB } = require("@leapmentor/shared/config/database");
    const AdminUser = require("@leapmentor/shared/models/AdminUser");
    const PlatformWallet = require("@leapmentor/shared/models/PlatformWallet");
    const apply = process.argv.includes("--apply");

    await connectDB();

    const report = await migrate({ AdminUser, PlatformWallet, apply });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

    if (!apply && report.status === "dry-run") {
        process.stdout.write("Dry run only. Rerun with --apply to write.\n");
    }
};

if (require.main === module) {
    main()
        .catch((err) => {
            process.stderr.write(`${err.stack || err.message}\n`);
            process.exitCode = 1;
        })
        .finally(async () => {
            if (mongoose.connection.readyState) {
                await mongoose.disconnect();
            }
        });
}

module.exports = { migrate };
