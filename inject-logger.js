#!/usr/bin/env node
/**
 * inject-logger.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Automatically injects Sentry logger into every controller and service file.
 *
 * What it does per file:
 *  1. Adds `const { logger } = require("@sentry/node");`  (if not already there)
 *  2. Replaces console.error / console.warn / console.log with the right logger level
 *  3. Injects logger.error() inside catch blocks that don't already have one,
 *     BEFORE any return statement (fixes unreachable code issue)
 *  4. Injects logger.info() before success return statements
 *
 * Usage:
 *   node inject-logger.js                          # dry-run (shows what will change)
 *   node inject-logger.js --write                  # writes changes to disk
 *   node inject-logger.js --write --dir ./src      # custom root directory
 *   node inject-logger.js --write --only controllers
 *   node inject-logger.js --write --only services
 *   node inject-logger.js --write --file controllers/goal.controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fs = require("fs");
const path = require("path");

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const onlyIdx = args.indexOf("--only");
const ONLY = onlyIdx !== -1 ? args[onlyIdx + 1] : null;
const fileIdx = args.indexOf("--file");
const SINGLE = fileIdx !== -1 ? args[fileIdx + 1] : null;
const dirIdx = args.indexOf("--dir");
const ROOT = dirIdx !== -1 ? args[dirIdx + 1] : process.cwd();

const SENTRY_IMPORT = `const { logger } = require("@sentry/node");`;

// ── Colours ───────────────────────────────────────────────────────────────────
const g = (s) => `\x1b[32m${s}\x1b[0m`;
const y = (s) => `\x1b[33m${s}\x1b[0m`;
const c = (s) => `\x1b[36m${s}\x1b[0m`;
const d = (s) => `\x1b[2m${s}\x1b[0m`;

// ── File collection ───────────────────────────────────────────────────────────
function collectFiles() {
    if (SINGLE) {
        const abs = path.resolve(ROOT, SINGLE);
        if (!fs.existsSync(abs)) { console.error(`File not found: ${abs}`); process.exit(1); }
        return [abs];
    }
    const dirs = [];
    if (!ONLY || ONLY === "controllers") {
        dirs.push(path.join(ROOT, "controllers"));
        const adminDir = path.join(ROOT, "controllers", "admin");
        if (fs.existsSync(adminDir)) dirs.push(adminDir);
    }
    if (!ONLY || ONLY === "services") {
        dirs.push(path.join(ROOT, "services"));
    }
    const files = [];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) { console.warn(y(`⚠  Not found: ${dir}`)); continue; }
        for (const f of fs.readdirSync(dir)) {
            if (f.endsWith(".js")) files.push(path.join(dir, f));
        }
    }
    return files;
}

// ── Brace-aware catch block finder ───────────────────────────────────────────
function findCatchBlocks(src) {
    const blocks = [];
    const catchRe = /\}\s*catch\s*\((\w+)\)\s*\{/g;
    let m;
    while ((m = catchRe.exec(src)) !== null) {
        const openBrace = m.index + m[0].length - 1;
        let depth = 1;
        let i = openBrace + 1;
        while (i < src.length && depth > 0) {
            if (src[i] === "{") depth++;
            else if (src[i] === "}") depth--;
            i++;
        }
        const closeBrace = i - 1;
        blocks.push({
            matchStart: m.index,
            openBrace,
            closeBrace,
            errVar: m[1],
            body: src.slice(openBrace + 1, closeBrace),
        });
    }
    return blocks;
}

// ── Find the first return statement position inside a catch body ──────────────
// Returns the character index (relative to full src) of the first `return`
// that appears at the top level of the catch block (not nested deeper).
function findFirstReturnInBlock(src, openBrace, closeBrace) {
    let depth = 0;
    let i = openBrace + 1;
    while (i < closeBrace) {
        if (src[i] === "{") { depth++; i++; continue; }
        if (src[i] === "}") { depth--; i++; continue; }
        // Only look at top-level (depth === 0)
        if (depth === 0 && src.slice(i, i + 6) === "return") {
            // Make sure it's a keyword, not e.g. "returnValue"
            const charAfter = src[i + 6];
            if (!charAfter || /[\s(;]/.test(charAfter)) {
                return i;
            }
        }
        i++;
    }
    return -1; // no return found
}

// ── Core transform ────────────────────────────────────────────────────────────
function transform(src, filePath) {
    const report = [];
    let code = src;
    const baseName = path.basename(filePath, ".js");

    // 1. Sentry import ───────────────────────────────────────────────────────────
    if (!code.includes("@sentry/node")) {
        const matches = [...code.matchAll(/^(?:const|let|var)\s+\S[^\n]*require\([^\n]+\);?\s*$/gm)];
        if (matches.length) {
            const last = matches[matches.length - 1];
            const pos = last.index + last[0].length;
            code = code.slice(0, pos) + "\n" + SENTRY_IMPORT + code.slice(pos);
        } else {
            code = SENTRY_IMPORT + "\n" + code;
        }
        report.push(g("+ sentry import added"));
    } else {
        report.push(d("✓ sentry import already present"));
    }

    // 2. console.* → logger.* ────────────────────────────────────────────────────
    const consoleMap = [
        ["console.error", "logger.error"],
        ["console.warn", "logger.warn"],
        ["console.log", "logger.info"],
    ];
    for (const [from, to] of consoleMap) {
        const re = new RegExp(from.replace(".", "\\."), "g");
        if (re.test(code)) {
            code = code.replace(re, to);
            report.push(y(`~ ${from} → ${to}`));
        }
    }

    // 3. Inject logger.error into catch blocks — BEFORE any return ───────────────
    let catchInjectCount = 0;
    const blocks = findCatchBlocks(code).reverse(); // reverse so positions stay valid
    for (const blk of blocks) {
        if (/logger\.(error|warn|captureException)/.test(blk.body)) continue;

        // Detect indentation from the first non-empty line in the catch body
        const bodyLines = blk.body.split("\n");
        const firstNonEmpty = bodyLines.find(l => l.trim().length > 0) || "";
        const indent = firstNonEmpty.match(/^(\s*)/)[1] || "    ";

        const logLine = `${indent}logger.error("Unhandled error in ${baseName}", { error: ${blk.errVar}.message, stack: ${blk.errVar}.stack });\n`;

        // Find the first top-level `return` inside the catch block
        const returnPos = findFirstReturnInBlock(code, blk.openBrace, blk.closeBrace);

        if (returnPos !== -1) {
            // Insert logger.error on the line BEFORE the return statement
            // Walk back to find the start of that line
            let lineStart = returnPos;
            while (lineStart > 0 && code[lineStart - 1] !== "\n") lineStart--;
            code = code.slice(0, lineStart) + logLine + code.slice(lineStart);
        } else {
            // No return — insert just before closing brace (original behaviour)
            code = code.slice(0, blk.closeBrace) + "\n" + logLine + code.slice(blk.closeBrace);
        }
        catchInjectCount++;
    }
    if (catchInjectCount > 0) report.push(g(`+ logger.error injected into ${catchInjectCount} catch block(s)`));

    // 4. logger.info before success returns ─────────────────────────────────────
    const lines = code.split("\n");
    const out = [];
    let infoCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        const isSuccess =
            /return\s+res\s*\.(?:status\s*\(\s*2\d{2}\s*\)\s*\.)?json\(/.test(trimmed) ||
            /return\s+res\s*\.send\(/.test(trimmed);

        if (isSuccess) {
            const window = lines.slice(Math.max(0, i - 5), i).join("\n");
            if (!window.includes("logger.info") && !window.includes("logger.warn")) {
                let fnName = baseName;
                for (let j = i - 1; j >= Math.max(0, i - 40); j--) {
                    const m = lines[j].match(/const\s+(\w+)\s*=\s*async/) ||
                        lines[j].match(/async\s+function\s+(\w+)/);
                    if (m) { fnName = m[1]; break; }
                }
                const indent = line.match(/^(\s*)/)[1];
                out.push(`${indent}logger.info("${fnName} completed successfully");`);
                infoCount++;
            }
        }
        out.push(line);
    }

    if (infoCount > 0) {
        code = out.join("\n");
        report.push(g(`+ logger.info added before ${infoCount} success return(s)`));
    }

    return { changed: code !== src, code, report };
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
    const files = collectFiles();
    if (!files.length) { console.log(y("No files found.")); process.exit(0); }

    console.log(`\n\x1b[1minject-logger\x1b[0m  mode=${WRITE ? c("WRITE") : y("DRY-RUN")}  root=${ROOT}\n`);

    let changed = 0, skipped = 0;

    for (const filePath of files) {
        const rel = path.relative(ROOT, filePath);
        const src = fs.readFileSync(filePath, "utf8");
        const res = transform(src, filePath);

        if (!res.changed) {
            console.log(`${d("─")} ${d(rel)}  ${d("(no changes)")}`);
            skipped++;
            continue;
        }

        console.log(`${g("✔")} ${c(rel)}`);
        for (const r of res.report) console.log(`   ${r}`);

        if (WRITE) {
            fs.writeFileSync(filePath, res.code, "utf8");
            console.log(`   ${g("→ written")}`);
        } else {
            const a = src.split("\n"), b = res.code.split("\n");
            let shown = 0;
            for (let i = 0; i < Math.max(a.length, b.length) && shown < 6; i++) {
                if (a[i] !== b[i]) {
                    if (a[i] !== undefined) console.log(`   \x1b[31m-\x1b[0m ${d(a[i])}`);
                    if (b[i] !== undefined) console.log(`   ${g("+")} ${b[i]}`);
                    shown++;
                }
            }
            if (shown === 6) console.log(`   ${d("… run with --write to apply all")}`);
        }
        console.log();
        changed++;
    }

    console.log("─".repeat(60));
    console.log(`\x1b[1mSummary\x1b[0m`);
    console.log(`  Files scanned : ${files.length}`);
    console.log(`  ${g("Modified")}      : ${changed}`);
    console.log(`  ${d("Unchanged")}     : ${skipped}`);

    if (!WRITE && changed > 0) {
        console.log(`\n${y("Dry-run complete.")} Run with ${c("--write")} to apply changes.\n`);
    } else if (WRITE) {
        console.log(`\n${g("All changes written to disk.")}\n`);
    }
}

main();