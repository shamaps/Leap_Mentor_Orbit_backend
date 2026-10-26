
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });
const { runWithTraceId } = require("@leapmentor/shared/utils/requestContext");
const payments = require("../src/clients/payments.client");
const catalog = require("../src/clients/catalog.client");

(async () => {
    let failed = false;
    for (const [name, client] of [["payments", payments], ["catalog", catalog]]) {
        const started = Date.now();
        try {
            const out = await runWithTraceId(`ping-${Date.now()}`, () => client.get("/internal/ping"));
            console.log(`OK   ${name.padEnd(9)} ${Date.now() - started}ms`, JSON.stringify(out));
        } catch (err) {
            failed = true;
            console.log(`FAIL ${name.padEnd(9)} ${Date.now() - started}ms  status=${err.status} message="${err.message}"`);
        }
    }
    process.exit(failed ? 1 : 0);
})();