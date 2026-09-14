#!/usr/bin/env node
/**
 * Promote plate imagery into the fields the catalogue reads.
 *
 * The catalogue renders `products.imageUrl` and `productGroups.heroImageUrl`.
 * Both hold Shopify CDN URLs for files that have since been deleted — a probe
 * of 40 group heroes returned 37 404s — while the plate index holds the same
 * products on permanent Vercel Blob URLs.
 *
 * This copies the plate URL into those fields and keeps the superseded value in
 * `legacyShopifyImageUrl` / `legacyShopifyHeroImageUrl`. Rows without a plate
 * are left untouched.
 *
 * Dry-run by default. Nothing is written without --apply.
 *
 *   node scripts/promote-plate-imagery.mjs                 # report only
 *   node scripts/promote-plate-imagery.mjs --apply         # write to CONVEX_URL
 *   node scripts/promote-plate-imagery.mjs --apply --prod  # write to production
 */
import { ConvexHttpClient } from "convex/browser";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
}

const apply = process.argv.includes("--apply");
const useProd = process.argv.includes("--prod");

const url = useProd ? process.env.CONVEX_PROD_URL : process.env.NEXT_PUBLIC_CONVEX_URL;
const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
if (!url) { console.error(useProd ? "CONVEX_PROD_URL is not set" : "NEXT_PUBLIC_CONVEX_URL is not set"); process.exit(1); }
if (!writeToken) { console.error("BEST_BOTTLES_CONVEX_WRITE_TOKEN is not set"); process.exit(1); }

const client = new ConvexHttpClient(url);
const dryRun = !apply;

console.log(`Deployment : ${url}`);
console.log(`Mode       : ${apply ? "APPLY" : "DRY-RUN"}\n`);

// ── products ────────────────────────────────────────────────────────────────
const skus = [];
let cursor = null;
for (;;) {
    const page = await client.query("products:getAllForPlates", { limit: 500, cursor });
    for (const row of page.page) if (row.websiteSku) skus.push(row.websiteSku);
    if (page.isDone) break;
    cursor = page.continueCursor;
}
console.log(`products with a website SKU: ${skus.length}`);

let promoted = 0, skipped = 0, noPlate = 0;
const examples = [];
for (let i = 0; i < skus.length; i += 200) {
    const res = await client.mutation("productPlates:promotePlateImagery", {
        writeToken, skus: skus.slice(i, i + 200), dryRun,
    });
    promoted += res.promoted; skipped += res.skipped; noPlate += res.noPlate;
    if (examples.length < 3) examples.push(...res.examples.slice(0, 3 - examples.length));
    process.stdout.write(`\r  ${Math.min(i + 200, skus.length)}/${skus.length}`);
}
console.log(`\n  ${apply ? "promoted" : "would promote"}: ${promoted}`);
console.log(`  already current   : ${skipped}`);
console.log(`  no plate yet      : ${noPlate}`);
for (const ex of examples) {
    console.log(`\n  ${ex.sku}\n    from ${ex.from.slice(0, 84)}\n    to   ${ex.to.slice(0, 84)}`);
}

// ── group heroes ────────────────────────────────────────────────────────────
const groups = await client.query("products:getAllCatalogGroups", {});
const slugs = groups.map((g) => g.slug).filter(Boolean);
console.log(`\nproduct groups: ${slugs.length}`);

let gPromoted = 0, gSkipped = 0, gNoPlate = 0;
for (let i = 0; i < slugs.length; i += 60) {
    const res = await client.mutation("productPlates:promoteGroupHeroImagery", {
        writeToken, slugs: slugs.slice(i, i + 60), dryRun,
    });
    gPromoted += res.promoted; gSkipped += res.skipped; gNoPlate += res.noPlate;
    process.stdout.write(`\r  ${Math.min(i + 60, slugs.length)}/${slugs.length}`);
}
console.log(`\n  ${apply ? "promoted" : "would promote"}: ${gPromoted}`);
console.log(`  already current   : ${gSkipped}`);
console.log(`  no plate yet      : ${gNoPlate}`);

if (!apply) console.log("\nDry-run. Add --apply to write.");
