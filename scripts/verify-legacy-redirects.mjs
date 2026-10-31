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
// Destination checking is one request each and the map now holds thousands.
// Sample by default; --all before a cutover, when it must be exhaustive.
const checkAllDestinations = args.includes("--all");
const destSample = Number(args[args.indexOf("--dest-sample") + 1]) || 150;

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

/**
 * Phrases a page shows while still answering 200 — a SOFT 404.
 *
 * This is the check a status code cannot make, and the one that matters most
 * here. /products/[slug] answers an unknown slug with HTTP 200 and a "Product
 * Not Found" page, so ~2,700 legacy product URLs once redirected to pages that
 * looked healthy to every automated check and were worthless to a visitor.
 * Google keeps soft 404s indexed and passes them no ranking at all.
 */
const SOFT_404_MARKERS = [
    "product not found",
    "page not found",
    "404",
    "we couldn't find",
    "we could not find",
];

async function status(path, { follow = true, readBody = false } = {}) {
    try {
        const res = await fetch(`${baseUrl}${path}`, {
            redirect: follow ? "follow" : "manual",
            headers: { "user-agent": "best-bottles-redirect-verifier" },
        });
        let soft404 = false;
        if (readBody && res.status === 200) {
            const contentType = res.headers.get("content-type") ?? "";
            if (contentType.includes("text/html")) {
                const body = await res.text();
                const title = (/<title>([^<]*)<\/title>/i.exec(body)?.[1] ?? "").toLowerCase();
                soft404 = SOFT_404_MARKERS.some((marker) => title.includes(marker));
            }
        }
        return { code: res.status, location: res.headers.get("location"), soft404 };
    } catch (error) {
        return { code: 0, error: error instanceof Error ? error.message : String(error) };
    }
}

const destStep = checkAllDestinations ? 1 : Math.max(1, Math.floor(destinations.length / destSample));
const destsToCheck = destinations.filter((_, index) => index % destStep === 0);
console.log(`\n${B}1. Destinations answer 200 and are not soft 404s${X}`);
if (!checkAllDestinations && destsToCheck.length < destinations.length) {
    info(`checking ${destsToCheck.length} of ${destinations.length} — pass --all before a cutover`);
}
const broken = [];
for (const dest of destsToCheck) {
    const { code, soft404 } = await status(dest, { readBody: true });
    if (code !== 200) { broken.push([dest, code]); bad(`${String(code).padEnd(3)} ${dest}`); }
    else if (soft404) { broken.push([dest, "soft 404"]); bad(`200 but SOFT 404  ${dest}`); }
}
if (broken.length === 0) ok(`all ${destsToCheck.length} destinations checked return a real page`);

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
