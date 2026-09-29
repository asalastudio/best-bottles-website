#!/usr/bin/env node
/**
 * 2026-09-28 — five clear Elegant 60 mL tassel sprayers are filed as plain bulb sprayers (size audit, 27 Sep).
 *
 *   GBElg60AnSpTsl{Gl,MtSl,Red,Wht,IvySl}: applicator "Vintage Bulb Sprayer" → "Vintage Bulb Sprayer with Tassel",
 *   and each moves from elegant-60ml-clear-18-415-antiquespray (the plain page) to
 *   elegant-60ml-clear-18-415-antiquespray-tassel, where the other four clear tassels (Lvn, IvyGl, Pnk, Blk) and the
 *   frosted page's six already sit. On the plain page they framed every plain Elegant 60 page for a tassel (−17%).
 *
 * Wrong the same way on dev and production. Every field write is guarded and logged in catalogChangeLog; the move
 * is a no-op once a SKU is on the tassel page.
 *
 *   node scripts/catalog-corrections/2026-09-28-elegant-60-tassels.mjs            # dry run, dev
 *   node scripts/catalog-corrections/2026-09-28-elegant-60-tassels.mjs --apply    # write, dev
 *   node scripts/catalog-corrections/2026-09-28-elegant-60-tassels.mjs --prod [--apply]
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

const REASON = "2026-09-28 Elegant 60 mL clear tassel sprayers filed as plain bulb sprayers (size audit; Jordan)";
const SKUS = ["GBElg60AnSpTslGl", "GBElg60AnSpTslMtSl", "GBElg60AnSpTslRed", "GBElg60AnSpTslWht", "GBElg60AnSpTslIvySl"];
const TASSEL_PAGE = "elegant-60ml-clear-18-415-antiquespray-tassel";

const client = new ConvexHttpClient(url);
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}`);
let problems = 0;

const fields = await client.mutation("catalogCorrections:correctProductFields", {
    writeToken, dryRun: !apply, reason: REASON,
    entries: SKUS.map(websiteSku => ({ websiteSku, expect: { applicator: "Vintage Bulb Sprayer" }, patch: { applicator: "Vintage Bulb Sprayer with Tassel" } })),
});
for (const w of fields.written) console.log(`  ${apply ? "wrote" : "would write"} ${w.websiteSku}.${w.field}: ${w.before} → ${w.after}`);
if (fields.alreadyCorrect.length) console.log(`  already correct: ${fields.alreadyCorrect.join(", ")}`);
if (fields.changedSince.length) console.log(`  changed since, left alone: ${fields.changedSince.map(c => `${c.websiteSku}.${c.field}=${c.now}`).join(", ")}`);
if (fields.notFound.length) console.log(`  not found: ${fields.notFound.join(", ")}`);
problems += fields.changedSince.length + fields.notFound.length;

const page = await client.query(anyApi.products.getProductGroup, { slug: TASSEL_PAGE });
if (!page) { console.log(`  ${TASSEL_PAGE} does not exist here`); process.exit(1); }
const onPage = new Set(page.variants.map(variant => variant.websiteSku));
for (const websiteSku of SKUS) {
    if (onPage.has(websiteSku)) { console.log(`  ${websiteSku} already on ${TASSEL_PAGE}`); continue; }
    if (!apply) { console.log(`  would move ${websiteSku} to ${TASSEL_PAGE}`); continue; }
    const moved = await client.mutation("products:moveProductToGroup", { writeToken, websiteSku, groupSlug: TASSEL_PAGE });
    console.log(`  move ${websiteSku}: ${moved.moved ? "moved" : "not moved"} (${moved.detail}) ${moved.from ?? "?"} → ${moved.to}`);
    if (!moved.moved && moved.detail !== "already in this group") problems++;
}
if (problems) process.exitCode = 1;
