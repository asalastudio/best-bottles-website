#!/usr/bin/env node
/**
 * 2026-10-17 — 15 product pages whose main image 404s: products.imageUrl points at Shopify files Shopify has
 * deleted, and Shopify holds no media for these variants. 43 rows take their own published plate (productPlates);
 * the dead URL moves to legacyShopifyImageUrl. One row (CJBlu3) has no plate and is held, not written.
 * Plan, rollback values and contact sheet: data/catalog-corrections/2026-10-17-dead-pdp-images/.
 *
 * Guards, in order:
 *   1. plan.json and rollback.json agree row for row, and there are at most 50 rows (one mutation, one transaction);
 *   2. forward only: every new URL is on the plate store, answers 200, and its bytes hash to the plate's sha256
 *      recorded in the plan (the image on the contact sheet is the image written);
 *   3. a server-side dry run: every field must still hold the plan's old value (or already hold the new one).
 *      Anything else, or a missing row, aborts with nothing written;
 *   4. the write itself runs with allOrNothing, so a row that changes between the dry run and the write throws
 *      and Convex undoes the whole call. Each field written leaves one catalogChangeLog entry.
 *
 *   node scripts/catalog-corrections/2026-10-17-dead-pdp-images.mjs --prod                     # dry run
 *   node scripts/catalog-corrections/2026-10-17-dead-pdp-images.mjs --prod --apply             # write the plan
 *   node scripts/catalog-corrections/2026-10-17-dead-pdp-images.mjs --prod --rollback          # dry run of the undo
 *   node scripts/catalog-corrections/2026-10-17-dead-pdp-images.mjs --prod --rollback --apply  # put the old values back
 * Without --prod it runs against .env.local's deployment (dev), where most rows will not match: expected.
 * Needs the catalogCorrections change from the same PR deployed first (it ships with main's production build).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
}
const PROD_URL = "https://precise-raccoon-123.convex.cloud";
const PLATE_HOST = "yzy7l20k4yt6znzz.public.blob.vercel-storage.com";
const prod = process.argv.includes("--prod");
const apply = process.argv.includes("--apply");
const rollback = process.argv.includes("--rollback");
const url = prod ? PROD_URL : process.env.NEXT_PUBLIC_CONVEX_URL;
const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
if (!url || !writeToken) { console.error("NEXT_PUBLIC_CONVEX_URL and BEST_BOTTLES_CONVEX_WRITE_TOKEN must be set in .env.local"); process.exit(1); }
if (!prod && url === PROD_URL) { console.error(".env.local points at prod; pass --prod explicitly"); process.exit(1); }

const DIR = resolve(ROOT, "data/catalog-corrections/2026-10-17-dead-pdp-images");
const plan = JSON.parse(readFileSync(resolve(DIR, "plan.json"), "utf8"));
const before = JSON.parse(readFileSync(resolve(DIR, "rollback.json"), "utf8"));
const fail = (message) => { console.error(`ABORT: ${message}\nNothing was written.`); process.exit(1); };

// 1. the two files describe the same rows
if (plan.entries.length === 0 || plan.entries.length > 50) fail(`plan has ${plan.entries.length} rows; one call takes 1-50`);
const beforeBySku = new Map(before.rows.map(row => [row.websiteSku, row]));
if (beforeBySku.size !== plan.entries.length) fail("rollback.json and plan.json list different rows");
for (const e of plan.entries) {
    const b = beforeBySku.get(e.websiteSku);
    if (!b || b.imageUrl !== e.expect.imageUrl || (b.legacyShopifyImageUrl ?? null) !== (e.expect.legacyShopifyImageUrl ?? null)) {
        fail(`${e.websiteSku}: rollback.json does not hold the plan's old values`);
    }
}

const entries = plan.entries.map(e => rollback
    ? { websiteSku: e.websiteSku, expect: e.patch, patch: { imageUrl: beforeBySku.get(e.websiteSku).imageUrl, legacyShopifyImageUrl: beforeBySku.get(e.websiteSku).legacyShopifyImageUrl ?? null } }
    : { websiteSku: e.websiteSku, expect: e.expect, patch: e.patch });

// 2. the images about to be written are the approved files
if (!rollback) {
    const bad = [];
    await Promise.all(plan.entries.map(async e => {
        const target = new URL(e.patch.imageUrl);
        if (target.hostname !== PLATE_HOST) { bad.push(`${e.websiteSku}: ${target.hostname} is not the plate store`); return; }
        try {
            const response = await fetch(target);
            const bytes = Buffer.from(await response.arrayBuffer());
            const sha = createHash("sha256").update(bytes).digest("hex");
            if (response.status !== 200) bad.push(`${e.websiteSku}: plate answers ${response.status}`);
            else if (sha !== e.source.sha256) bad.push(`${e.websiteSku}: plate bytes hash to ${sha.slice(0, 12)}, plan says ${e.source.sha256.slice(0, 12)}`);
        } catch (error) { bad.push(`${e.websiteSku}: ${error.message}`); }
    }));
    if (bad.length) fail(`plate check failed:\n  ${bad.join("\n  ")}`);
    console.log(`plates: all ${plan.entries.length} answer 200 with the approved bytes`);
}

const client = new ConvexHttpClient(url);
const reason = `${rollback ? "rollback of " : ""}2026-10-17 dead Shopify product images replaced by each SKU's plate (data/catalog-corrections/2026-10-17-dead-pdp-images; approved by Jordan)`;
const call = async (dryRun) => {
    try {
        return await client.mutation("catalogCorrections:correctProductFields", { writeToken, dryRun, allOrNothing: true, reason, entries });
    } catch (error) {
        if (/imageUrl|legacyShopifyImageUrl|allOrNothing/.test(String(error.message)) && /validator|extra field|Object contains/i.test(String(error.message))) {
            fail("this deployment does not accept imageUrl corrections yet; merge the PR so the production build deploys convex/catalogCorrections.ts");
        }
        throw error;
    }
};

// 3. the server-side check
console.log(`${prod ? "PROD" : "dev"} · ${rollback ? "ROLLBACK" : "forward"} · ${apply ? "APPLY" : "dry run"} · ${entries.length} rows`);
const check = await call(true);
if (check.changedSince.length || check.notFound.length) {
    const lines = [...check.changedSince.map(c => `${c.websiteSku}.${c.field} now holds ${c.now}`), ...check.notFound.map(s => `${s} not found`)];
    fail(`${lines.length} fields no longer hold the plan's ${rollback ? "new" : "old"} value:\n  ${lines.join("\n  ")}`);
}
const pending = new Set(check.written.map(w => w.websiteSku));
for (const w of check.written) console.log(`  ${apply ? "will write" : "would write"} ${w.websiteSku}.${w.field}\n      ${w.before}\n    → ${w.after}`);
if (check.alreadyCorrect.length) console.log(`  already hold the ${rollback ? "old" : "new"} value: ${check.alreadyCorrect.join(", ")}`);
if (pending.size === 0) { console.log("Nothing to do: every row already holds the target values."); process.exit(0); }
if (!apply) { console.log(`Dry run: ${check.written.length} fields on ${pending.size} rows would change. Pass --apply to write.`); process.exit(0); }

// 4. the write, all or nothing
const result = await call(false);
console.log(`Wrote ${result.written.length} fields on ${new Set(result.written.map(w => w.websiteSku)).size} rows (one catalogChangeLog entry each).`);
const verify = await call(true);
if (verify.written.length || verify.changedSince.length || verify.notFound.length) {
    console.error("WARNING: the write succeeded but a re-check found rows that do not hold the target values; inspect before anything else:");
    console.error(JSON.stringify({ written: verify.written, changedSince: verify.changedSince, notFound: verify.notFound }, null, 1));
    process.exit(1);
}
console.log("Verified: every row now holds the target values.");
