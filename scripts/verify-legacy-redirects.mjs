#!/usr/bin/env node
/**
 * Prove every legacy redirect lands somewhere real.
 *
 * The unit tests check structure — no chains, no loops, no destination under a
 * route family we do not serve. Only an HTTP request can prove a destination
 * actually answers, which is the check the original May redirect map never had:
 * 47 of its 135 destinations pointed at pages that were never built.
 *
 * Two passes:
 *   1. Every DESTINATION must return 200.
 *   2. A sample of LEGACY paths must return 301 to the mapped destination.
 *
 * Usage:
 *   node scripts/verify-legacy-redirects.mjs --url https://best-bottles-website.vercel.app
 *   node scripts/verify-legacy-redirects.mjs --url http://localhost:3000 --sample 20
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const G = "\x1b[32m", R = "\x1b[31m", Y = "\x1b[33m", D = "\x1b[2m", B = "\x1b[1m", X = "\x1b[0m";
const ok = (s) => console.log(`${G}✓${X} ${s}`);
const bad = (s) => console.log(`${R}✗${X} ${s}`);
const warn = (s) => console.log(`${Y}⚠${X} ${s}`);
const info = (s) => console.log(`${D}  ${s}${X}`);

const args = process.argv.slice(2);
const baseUrl = (args[args.indexOf("--url") + 1] || "").replace(/\/$/, "");
const sampleSize = Number(args[args.indexOf("--sample") + 1]) || 25;

if (!baseUrl || !/^https?:\/\//.test(baseUrl)) {
    bad("Pass --url https://your-deployment");
    process.exit(1);
}
if (/your-deployment|example\.com/.test(baseUrl)) {
    bad(`--url looks like a placeholder: ${baseUrl}`);
    process.exit(1);
}

// Read the map out of the TypeScript source rather than importing it, so this
// runs without a build step.
const source = readFileSync(resolve(ROOT, "src/lib/seo/legacyRedirects.ts"), "utf8");
const pairs = [...source.matchAll(/\["([^"]+)",\s*"([^"]+)"\],/g)].map((m) => [m[1], m[2]]);
if (pairs.length === 0) {
    bad("No redirects parsed from src/lib/seo/legacyRedirects.ts");
    process.exit(1);
}

const destinations = [...new Set(pairs.map(([, dest]) => dest))];
console.log(`\n${B}Legacy redirect verification${X}`);
info(`Target:       ${baseUrl}`);
info(`Redirects:    ${pairs.length}`);
info(`Destinations: ${destinations.length}`);

async function status(path, { follow = true } = {}) {
    try {
        const res = await fetch(`${baseUrl}${path}`, {
            redirect: follow ? "follow" : "manual",
            headers: { "user-agent": "best-bottles-redirect-verifier" },
        });
        return { code: res.status, location: res.headers.get("location") };
    } catch (error) {
        return { code: 0, error: error instanceof Error ? error.message : String(error) };
    }
}

console.log(`\n${B}1. Destinations answer 200${X}`);
const broken = [];
for (const dest of destinations) {
    const { code } = await status(dest);
    if (code !== 200) { broken.push([dest, code]); bad(`${String(code).padEnd(3)} ${dest}`); }
}
if (broken.length === 0) ok(`all ${destinations.length} destinations return 200`);

console.log(`\n${B}2. Legacy paths 301 to the mapped destination${X}`);
const step = Math.max(1, Math.floor(pairs.length / sampleSize));
const sample = pairs.filter((_, index) => index % step === 0).slice(0, sampleSize);
const wrong = [];
for (const [legacy, expected] of sample) {
    const { code, location } = await status(legacy, { follow: false });
    const landed = location ? new URL(location, baseUrl).pathname + new URL(location, baseUrl).search : null;
    const expectedNoHash = expected.split("#")[0];
    if (code !== 301) { wrong.push([legacy, `got ${code}`]); bad(`${String(code).padEnd(3)} ${legacy}`); }
    else if (landed !== expectedNoHash) { wrong.push([legacy, `→ ${landed}`]); warn(`301 ${legacy}\n      expected ${expectedNoHash}\n      got      ${landed}`); }
}
if (wrong.length === 0) ok(`all ${sample.length} sampled legacy paths 301 correctly`);

console.log(`\n${B}Summary${X}`);
info(`${destinations.length - broken.length}/${destinations.length} destinations live`);
info(`${sample.length - wrong.length}/${sample.length} sampled redirects correct`);
if (broken.length || wrong.length) {
    bad("Verification failed — do NOT cut over with these unresolved.");
    process.exit(1);
}
ok("Redirect map is safe to cut over.");
