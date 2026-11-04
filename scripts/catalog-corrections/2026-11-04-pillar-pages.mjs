#!/usr/bin/env node
/**
 * 2026-11-04 — the Pillar 9 ml pages made whole (Jordan: "Yes, all of it"). Production had:
 *   - the cap page pillar-9ml-clear-13-415 holding the short black cap AND the two rollers, while it shows only caps,
 *     so the rollers could not be bought;
 *   - a broken empty group "pillar-9ml-clear-Size: GBPillar9BlkSht Nemat In" (a bad import; its last SKU moved out on
 *     2026-09-25), shown in the catalogue as "Product image coming soon";
 *   - the three cap and roller rows with pasted text in their sizes ("57 ±1 mm Item Diameter: 21 ±0."), the short cap
 *     20 mm wide and "Clear" as its cap colour, the rollers' applicator and cap colour as "N/A"/"Clear"/null.
 * Each step is guarded by the value it expects to find (refused if anything changed since):
 *   1. rows: sizes as bestbottles.com prints them (69/70 ±1 mm with cap, 57 ±1 mm without, 21 ±0.5 mm), cap colours
 *      and applicators as development already has them;
 *   2. the broken group becomes the Pillar roller page: slug pillar-9ml-clear-13-415-rollon, neck 13-415, its name,
 *      primary SKU and count; the two rollers move into it; the cap page counts one product;
 *   3. (after the code that adds them is deployed) both pages' "From $" ranges.
 *   4. (same) the matte black sprayer's price ladder (bestbottles.com: 1+ $0.97, 12+ $0.92, 144+ $0.87, 526+ $0.82,
 *      2630+ $0.76); its row had only the 1-piece price.
 * The six missing sprayer finishes are 2026-11-04-pillar-sprayer-finishes.mjs.
 *
 *   node scripts/catalog-corrections/2026-11-04-pillar-pages.mjs --prod                 # dry run, production
 *   node scripts/catalog-corrections/2026-11-04-pillar-pages.mjs --prod --apply         # steps 1-2
 *   node scripts/catalog-corrections/2026-11-04-pillar-pages.mjs --prod --apply --late  # steps 3-4 (after deploy)
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
const PROD_URL = "https://precise-raccoon-123.convex.cloud", DEV_URL = "https://helpful-elephant-638.convex.cloud";
const prod = process.argv.includes("--prod"), apply = process.argv.includes("--apply"), late = process.argv.includes("--late");
const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
if (!writeToken) { console.error("BEST_BOTTLES_CONVEX_WRITE_TOKEN must be set in .env.local"); process.exit(1); }
const client = new ConvexHttpClient(prod ? PROD_URL : DEV_URL);
const dryRun = !apply;
const reason = "2026-11-04 Jordan: Pillar 9 ml pages made whole (roller page, sizes, cap colours)";
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}${late ? " (late steps)" : ""}`);

const BROKEN = "pillar-9ml-clear-Size: GBPillar9BlkSht Nemat In", CAPS = "pillar-9ml-clear-13-415", ROLL = "pillar-9ml-clear-13-415-rollon";
const SPRAY = "pillar-9ml-clear-17-415-finemist";
const show = (label, result) => console.log(`  ${label}: ${JSON.stringify(result)}`);

if (!late) {
    // 1. The three rows.
    const garbled = { heightWithoutCap: "57 ±1 mm Item Diameter: 21 ±0." };
    show("rows", await client.mutation(anyApi.catalogCorrections.correctProductFields, { writeToken, dryRun, reason, entries: [
        { websiteSku: "GBPillar9BlkShSht",
          expect: { ...garbled, heightWithCap: "69 ±1 mm Item Height without C", diameter: "20", capColor: "Clear" },
          patch: { heightWithoutCap: "57 ±1 mm", heightWithCap: "69 ±1 mm", diameter: "21 ±0.5 mm", capColor: "Shiny Black" } },
        { websiteSku: "GBPillar9RollBlkDot",
          expect: { ...garbled, heightWithCap: "70 ±1 mm Item Height without C", capColor: "Clear", applicator: "N/A" },
          patch: { heightWithoutCap: "57 ±1 mm", heightWithCap: "70 ±1 mm", capColor: "Black Dotted", applicator: "Plastic Roller Ball" } },
        { websiteSku: "GBPillar9MtlRollBlkdot",
          expect: { ...garbled, heightWithCap: "70 ±1 mm Item Height without C", capColor: null, applicator: "N/A" },
          patch: { heightWithoutCap: "57 ±1 mm", heightWithCap: "70 ±1 mm", capColor: "Black Dotted", applicator: "Metal Roller Ball" } },
    ] }));
    // 2. The roller page, from the broken group.
    show("group slug", await client.mutation(anyApi.catalogCorrections.correctGroupFields, { writeToken, dryRun, reason, entries: [
        { slug: BROKEN, expect: { slug: BROKEN, neckThreadSize: "Size: GBPillar9BlkSht Nemat In" }, patch: { slug: ROLL, neckThreadSize: "13-415" } },
    ] }));
    const rollSlug = apply ? ROLL : BROKEN;   // a dry run has not renamed it
    show("roller page", await client.mutation(anyApi.catalogRestore.restoreGroupFields, { writeToken, dryRun, entries: [
        { slug: rollSlug, expect: { displayName: "9 ml Clear Pillar Bottle with Cap", variantCount: 1, primaryWebsiteSku: null, primaryGraceSku: null },
          patch: { displayName: "9 ml Clear Pillar Roll-On Bottle", variantCount: 2, primaryWebsiteSku: "GBPillar9RollBlkDot", primaryGraceSku: "GB-PIL-CLR-9ML-RBL-BDOT" } },
        { slug: CAPS, expect: { variantCount: 2, primaryWebsiteSku: null, primaryGraceSku: null }, patch: { variantCount: 1, primaryWebsiteSku: "GBPillar9BlkShSht", primaryGraceSku: "GB-PIL-CLR-9ML-CAP-BLK" } },
    ] }));
    if (apply) {
        for (const sku of ["GBPillar9RollBlkDot", "GBPillar9MtlRollBlkdot"])
            show(`move ${sku}`, await client.mutation(anyApi.products.moveProductToGroup, { writeToken, websiteSku: sku, groupSlug: ROLL }));
    } else console.log(`  would move GBPillar9RollBlkDot and GBPillar9MtlRollBlkdot into ${ROLL}`);
} else {
    // 3-4. After deploy: price ranges and the matte black ladder.
    show("price ranges", await client.mutation(anyApi.catalogRestore.restoreGroupFields, { writeToken, dryRun, entries: [
        { slug: CAPS, expect: { priceRangeMin: 0.83, priceRangeMax: 0.89 }, patch: { priceRangeMin: 0.44, priceRangeMax: 0.44 } },
        { slug: ROLL, expect: { priceRangeMin: 0.44, priceRangeMax: 0.44 }, patch: { priceRangeMin: 0.83, priceRangeMax: 0.89 } },
        { slug: SPRAY, expect: { variantCount: 1 }, patch: { variantCount: 7 } },
    ] }));
    show("matte black ladder", await client.mutation(anyApi.catalogRestore.setMissingPriceLadder, { writeToken, dryRun, websiteSku: "GBPillar9SpryBlkMatt", priceTiers: [
        { minQty: 1, unitPrice: 0.97, totalPrice: 0.97 }, { minQty: 12, unitPrice: 0.92, totalPrice: 11.06 },
        { minQty: 144, unitPrice: 0.87, totalPrice: 125.71 }, { minQty: 526, unitPrice: 0.82, totalPrice: 433.69 },
        { minQty: 2630, unitPrice: 0.76, totalPrice: 1989.86 } ] }));
}
