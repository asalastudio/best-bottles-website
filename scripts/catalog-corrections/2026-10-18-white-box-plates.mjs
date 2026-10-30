#!/usr/bin/env node
/**
 * 2026-10-18: product pages whose stage shows a flat photo inside its own white box. These SKUs have no kit and
 * no released hero, so the stage falls back to productPlates.front, a plate flattened onto white. Each row's
 * front is replaced by a composed plate: the live plate with its white made transparent (same master PSD, same
 * placement) or the bone-background hero the catalogue card already shows for the SKU. Circle 30 ml glass is
 * held (see the plan). Plan, rollback values, plate files and contact sheet:
 * data/catalog-corrections/2026-10-18-white-box-plates/.
 *
 * Guards, in order:
 *   1. plan.json and rollback.json agree row for row, and there are at most 50 rows (one mutation, one transaction);
 *   2. forward: every plate file in the PR hashes to the plan's sha256 and length, and its store key and URL are the
 *      content-addressed ones; rollback: every old front still answers 200 with its recorded bytes;
 *   3. a server-side dry run: every row must still hold the plan's old front (or already hold the new one).
 *      Anything else, or a missing row, aborts with nothing written;
 *   4. --apply uploads only the plates still pending (content-addressed, never overwriting) and checks each public
 *      URL (200, image/webp, length, CORS, one-year cache, sha256) before any row is touched;
 *   5. the write runs as one all-or-nothing mutation, and a re-check confirms every row afterwards.
 *
 *   node scripts/catalog-corrections/2026-10-18-white-box-plates.mjs --prod                     # dry run
 *   node scripts/catalog-corrections/2026-10-18-white-box-plates.mjs --prod --apply             # upload + write
 *   node scripts/catalog-corrections/2026-10-18-white-box-plates.mjs --prod --rollback          # dry run of the undo
 *   node scripts/catalog-corrections/2026-10-18-white-box-plates.mjs --prod --rollback --apply  # put the old fronts back
 * Without --prod it runs against .env.local's deployment (dev), where rows will not match: expected.
 * Needs productPlates:replacePlateFronts deployed first (it ships with main's production build), and
 * BLOB_READ_WRITE_TOKEN for a forward --apply.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import { createBlobStore, verifyPublicUrl } from "../paperdoll/lib/store-blob.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
}
const PROD_URL = "https://precise-raccoon-123.convex.cloud";
const PLATE_HOST = "https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com";
const prod = process.argv.includes("--prod");
const apply = process.argv.includes("--apply");
const rollback = process.argv.includes("--rollback");
const url = prod ? PROD_URL : process.env.NEXT_PUBLIC_CONVEX_URL;
const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
if (!url || !writeToken) { console.error("NEXT_PUBLIC_CONVEX_URL and BEST_BOTTLES_CONVEX_WRITE_TOKEN must be set in .env.local"); process.exit(1); }
if (!prod && url === PROD_URL) { console.error(".env.local points at prod; pass --prod explicitly"); process.exit(1); }

const DIR = resolve(ROOT, "data/catalog-corrections/2026-10-18-white-box-plates");
const plan = JSON.parse(readFileSync(resolve(DIR, "plan.json"), "utf8"));
const before = JSON.parse(readFileSync(resolve(DIR, "rollback.json"), "utf8"));
const fail = (message) => { console.error(`ABORT: ${message}\nNothing was written.`); process.exit(1); };
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

// 1. the two files describe the same rows
if (plan.entries.length === 0 || plan.entries.length > 50) fail(`plan has ${plan.entries.length} rows; one call takes 1-50`);
const beforeBySku = new Map(before.rows.map(row => [row.sku, row]));
if (beforeBySku.size !== plan.entries.length) fail("rollback.json and plan.json list different rows");
for (const e of plan.entries) {
    const b = beforeBySku.get(e.sku);
    if (!b || b.front.sha256 !== e.expectFront.sha256 || b.front.url !== e.expectFront.url) fail(`${e.sku}: rollback.json does not hold the plan's old front`);
}
const entries = plan.entries.map(e => rollback
    ? { sku: e.sku, expectFront: { sha256: e.front.sha256, url: e.front.url }, front: beforeBySku.get(e.sku).front }
    : { sku: e.sku, expectFront: e.expectFront, front: e.front });

// 2. the bytes behind every front about to be written
const bytesBySku = new Map();
if (!rollback) {
    const bad = [];
    for (const e of plan.entries) {
        const bytes = readFileSync(resolve(ROOT, e.file));
        const key = `plates/${e.familyId}/${e.sku}/${e.front.sha256}.front-on-1000x1100.webp`;
        if (sha256(bytes) !== e.front.sha256 || bytes.length !== e.front.bytes) bad.push(`${e.sku}: ${e.file} does not hash to the plan's front`);
        else if (e.front.key !== key || e.front.url !== `${PLATE_HOST}/${key}`) bad.push(`${e.sku}: the front's key or url is not the content-addressed one`);
        else bytesBySku.set(e.sku, bytes);
    }
    if (bad.length) fail(`plate files:\n  ${bad.join("\n  ")}`);
    console.log(`plates: all ${plan.entries.length} files in the PR match the plan`);
} else {
    const bad = [];
    await Promise.all(entries.map(async e => {
        try {
            const response = await fetch(e.front.url);
            const bytes = Buffer.from(await response.arrayBuffer());
            if (response.status !== 200) bad.push(`${e.sku}: old front answers ${response.status}`);
            else if (sha256(bytes) !== e.front.sha256) bad.push(`${e.sku}: old front no longer hashes to ${e.front.sha256.slice(0, 12)}`);
        } catch (error) { bad.push(`${e.sku}: ${error.message}`); }
    }));
    if (bad.length) fail(`old fronts:\n  ${bad.join("\n  ")}`);
    console.log(`old fronts: all ${entries.length} still answer 200 with their recorded bytes`);
}

const client = new ConvexHttpClient(url);
const call = async (dryRun) => {
    try {
        return await client.mutation(api.productPlates.replacePlateFronts, { writeToken, dryRun, entries });
    } catch (error) {
        if (/replacePlateFronts/.test(String(error.message)) && /Could not find|not found|No such function/i.test(String(error.message))) {
            fail("this deployment has no productPlates:replacePlateFronts yet; merge the PR so the production build deploys it");
        }
        throw error;
    }
};

// 3. the server-side check
console.log(`${prod ? "PROD" : "dev"} · ${rollback ? "ROLLBACK" : "forward"} · ${apply ? "APPLY" : "dry run"} · ${entries.length} rows`);
const check = await call(true);
if (check.refused.length) {
    fail(`${check.refused.length} rows no longer hold the plan's ${rollback ? "new" : "old"} front:\n  ${check.refused.map(r => `${r.sku} ${r.reason}${r.now ? ` (now ${r.now})` : ""}`).join("\n  ")}`);
}
for (const sku of check.replaced) {
    const e = entries.find(x => x.sku === sku);
    console.log(`  ${apply ? "will replace" : "would replace"} ${sku}.front\n      ${e.expectFront.url}\n    → ${e.front.url}`);
}
if (check.alreadyReplaced.length) console.log(`  already hold the ${rollback ? "old" : "new"} front: ${check.alreadyReplaced.join(", ")}`);
if (check.replaced.length === 0) { console.log("Nothing to do: every row already holds the target front."); process.exit(0); }
if (!apply) { console.log(`Dry run: ${check.replaced.length} fronts would change. Pass --apply to write.`); process.exit(0); }

// 4. the plates a browser will fetch, before any row points at them
if (!rollback) {
    const store = createBlobStore();
    for (const sku of check.replaced) {
        const e = entries.find(x => x.sku === sku);
        const { url: stored, existed } = await store.putObject(e.front.key, bytesBySku.get(sku), "image/webp");
        if (stored !== e.front.url) fail(`${sku}: the store answered ${stored}, expected ${e.front.url}`);
        const head = await verifyPublicUrl(e.front.url, { expectedBytes: e.front.bytes, expectedContentType: "image/webp" });
        if (!head.ok) fail(`${sku}: ${e.front.url} ${head.problems.join(", ")}`);
        const served = Buffer.from(await (await fetch(e.front.url)).arrayBuffer());
        if (sha256(served) !== e.front.sha256) fail(`${sku}: the public URL serves different bytes`);
        console.log(`  ${existed ? "already stored" : "uploaded"} ${e.front.key}`);
    }
}

// 5. the write, all or nothing
const result = await call(false);
console.log(`Replaced ${result.replaced.length} plate fronts.`);
const verify = await call(true);
if (verify.replaced.length || verify.refused.length) {
    console.error("WARNING: the write succeeded but a re-check found rows that do not hold the target front; inspect before anything else:");
    console.error(JSON.stringify({ replaced: verify.replaced, refused: verify.refused }, null, 1));
    process.exit(1);
}
console.log(`Verified: all ${verify.alreadyReplaced.length} rows now hold the target front.`);
