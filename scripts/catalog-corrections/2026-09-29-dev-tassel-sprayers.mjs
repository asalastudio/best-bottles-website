#!/usr/bin/env node
/**
 * 2026-09-29 — dev catch-up (Jordan: "yes"): 17 tassel bulb sprayers are filed as plain ones on DEV only.
 * Production is already right (0 of its 239 tassel SKUs are plain); on dev these still read
 * applicator "Vintage Bulb Sprayer" and sit on the plain page:
 *
 *   GBRndFrst128AnSpTsl{Red,Gl,IvyGl,IvySl,Lvn,Pnk,Wht,MtSl,Blk} → round-128ml-frosted-18-415-antiquespray-tassel
 *   GBCrclFrst100AnSpTsl{Blk,IvySl,Lvn,Pnk,Red,Wht}              → circle-100ml-frosted-18-415-antiquespray-tassel
 *   GBCrcl50AnSpTsl{Red,MtSl}                                    → circle-50ml-clear-18-415-antiquespray-tassel
 *
 * Dev had no Round Frosted 128 tassel page. It was created on 29 Sep from production's record, with
 * `npx convex run migrations:addProductGroup` and then migrations:patchProductGroupFields for its primary SKUs. Every
 * field write is guarded and logged in catalogChangeLog; a move is a no-op once a SKU is on its tassel page.
 *
 *   node scripts/catalog-corrections/2026-09-29-dev-tassel-sprayers.mjs            # dry run, dev
 *   node scripts/catalog-corrections/2026-09-29-dev-tassel-sprayers.mjs --apply    # write, dev
 *   node scripts/catalog-corrections/2026-09-29-dev-tassel-sprayers.mjs --prod     # check production (expected: nothing to do)
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
}
const PROD_URL = "https://precise-raccoon-123.convex.cloud";
const prod = process.argv.includes("--prod");
const apply = process.argv.includes("--apply");
const url = prod ? PROD_URL : process.env.NEXT_PUBLIC_CONVEX_URL;
const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
if (!url || !writeToken) { console.error("NEXT_PUBLIC_CONVEX_URL and BEST_BOTTLES_CONVEX_WRITE_TOKEN must be set in .env.local"); process.exit(1); }
if (!prod && url === PROD_URL) { console.error(".env.local points at prod; pass --prod explicitly"); process.exit(1); }

const REASON = "2026-09-29 tassel bulb sprayers filed as plain on dev; production is right (dev catch-up, Jordan)";
const MOVES = [
    ...["Red", "Gl", "IvyGl", "IvySl", "Lvn", "Pnk", "Wht", "MtSl", "Blk"].map(c => [`GBRndFrst128AnSpTsl${c}`, "round-128ml-frosted-18-415-antiquespray-tassel"]),
    ...["Blk", "IvySl", "Lvn", "Pnk", "Red", "Wht"].map(c => [`GBCrclFrst100AnSpTsl${c}`, "circle-100ml-frosted-18-415-antiquespray-tassel"]),
    ...["Red", "MtSl"].map(c => [`GBCrcl50AnSpTsl${c}`, "circle-50ml-clear-18-415-antiquespray-tassel"]),
];

const client = new ConvexHttpClient(url);
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}`);
let problems = 0;

const fields = await client.mutation("catalogCorrections:correctProductFields", {
    writeToken, dryRun: !apply, reason: REASON,
    entries: MOVES.map(([websiteSku]) => ({ websiteSku, expect: { applicator: "Vintage Bulb Sprayer" }, patch: { applicator: "Vintage Bulb Sprayer with Tassel" } })),
});
for (const w of fields.written) console.log(`  ${apply ? "wrote" : "would write"} ${w.websiteSku}.${w.field}: ${w.before} → ${w.after}`);
if (fields.alreadyCorrect.length) console.log(`  already correct: ${fields.alreadyCorrect.join(", ")}`);
if (fields.changedSince.length) console.log(`  changed since, left alone: ${fields.changedSince.map(c => `${c.websiteSku}.${c.field}=${c.now}`).join(", ")}`);
if (fields.notFound.length) console.log(`  not found: ${fields.notFound.join(", ")}`);
problems += fields.changedSince.length + fields.notFound.length;

const pages = new Map();
for (const [websiteSku, slug] of MOVES) {
    if (!pages.has(slug)) pages.set(slug, await client.query(anyApi.products.getProductGroup, { slug }));
    const page = pages.get(slug);
    if (!page) { console.log(`  ${slug} does not exist here: create it first (see the header)`); problems++; continue; }
    if (page.variants.some(variant => variant.websiteSku === websiteSku)) { console.log(`  ${websiteSku} already on ${slug}`); continue; }
    if (!apply) { console.log(`  would move ${websiteSku} → ${slug}`); continue; }
    const moved = await client.mutation("products:moveProductToGroup", { writeToken, websiteSku, groupSlug: slug });
    console.log(`  move ${websiteSku}: ${moved.moved ? "moved" : "not moved"} (${moved.detail}) ${moved.from ?? "?"} → ${moved.to}`);
    if (!moved.moved && !/already/i.test(moved.detail)) problems++;
}
if (problems) process.exitCode = 1;
