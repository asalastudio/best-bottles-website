#!/usr/bin/env node
/**
 * 2026-09-29 — the frosted Elegant 100 reducer with the short matte silver cap (Jordan: Best Bottles sells it;
 * "I'm okay with that price"). The clear line has it (GBElg100RdcrMtSl); the frosted line had only the tall one, so
 * the review strips showed "Matte silver · no SKU" on Elegant 100 frosted.
 *
 *   GBElgFrst100RdcrMtSl · GB-ELG-FRS-100ML-RDC-MSLV · elegant-100ml-frosted-18-415-reducer
 *
 * products:createProductFromTwin copies everything physical from the frosted short shiny silver (same glass, same
 * short 18-415 cap), and takes the commercial fields as given: the frosted metal-cap ladder its siblings share
 * ($2.77, 12+ $2.63, 144+ $2.49, 224+ $2.35, 1120+ $2.16), and the twin's name and description with the cap named
 * the way the clear matte silver names it. The row starts quote-only; the Shopify variant
 * (scripts/shopify_add_elegant100_frosted_mtsl.mjs) links it through the webhook sync.
 *
 *   node scripts/catalog-corrections/2026-09-29-elegant-100-frosted-matte-silver.mjs            # dry run, dev
 *   node scripts/catalog-corrections/2026-09-29-elegant-100-frosted-matte-silver.mjs --apply    # write, dev
 *   node scripts/catalog-corrections/2026-09-29-elegant-100-frosted-matte-silver.mjs --prod [--apply]
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

const TWIN = "GBElgFrst100RdcrShnSl";
const SKU = "GBElgFrst100RdcrMtSl";
const GRACE = "GB-ELG-FRS-100ML-RDC-MSLV";
const PAGE = "elegant-100ml-frosted-18-415-reducer";
const LADDER = [[1, 2.77], [12, 2.63], [144, 2.49], [224, 2.35], [1120, 2.16]];   // the price Jordan approved

const client = new ConvexHttpClient(url);
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}`);
const page = await client.query(anyApi.products.getProductGroup, { slug: PAGE });
if (!page) { console.error(`  ${PAGE} does not exist here`); process.exit(1); }
if (page.variants.some(v => v.websiteSku === SKU)) { console.log(`  ${SKU} already on ${PAGE}: nothing to do`); process.exit(0); }
const twin = page.variants.find(v => v.websiteSku === TWIN);
if (!twin) { console.error(`  twin ${TWIN} is not on ${PAGE}`); process.exit(1); }

// The twin's ladder must be the approved one; the new SKU carries it tier for tier (totals included).
const tiers = [...(twin.priceTiers ?? [])].sort((a, b) => a.minQty - b.minQty);
const same = tiers.length === LADDER.length && tiers.every((t, i) => t.minQty === LADDER[i][0] && Math.abs(t.unitPrice - LADDER[i][1]) < 1e-9);
if (!same) { console.error(`  ${TWIN}'s ladder is no longer the approved one: ${JSON.stringify(tiers)}`); process.exit(1); }
const rename = (text) => {
    if ((text.match(/shiny silver cap/g) ?? []).length !== 1) throw new Error(`expected "shiny silver cap" once in: ${text}`);
    return text.replace("shiny silver cap", "silver matte cap");
};
const args = {
    writeToken, twinWebsiteSku: TWIN, websiteSku: SKU, graceSku: GRACE, groupSlug: PAGE,
    color: twin.color, capColor: "Matte Silver",
    itemName: rename(twin.itemName), itemDescription: rename(twin.itemDescription ?? twin.itemName),
    priceTiers: tiers.map(t => ({ minQty: t.minQty, unitPrice: t.unitPrice, totalPrice: t.totalPrice })),
    source: "2026-09-29 Jordan: frosted Elegant 100 reducer, short matte silver cap (twin GBElgFrst100RdcrShnSl; clear sibling GBElg100RdcrMtSl)",
};
console.log(`  ${apply ? "creating" : "would create"} ${SKU} (${GRACE}) on ${PAGE}, twin ${TWIN}`);
console.log(`    ${args.color} glass · ${args.capColor} cap · ladder ${tiers.map(t => `${t.minQty}+ $${t.unitPrice}`).join(", ")}`);
console.log(`    name: ${args.itemName.slice(0, 110)}…`);
if (!apply) process.exit(0);
const result = await client.mutation(anyApi.products.createProductFromTwin, args);
console.log(`  ${result.created ? "created" : "NOT created"}: ${result.detail}`);
if (!result.created) process.exitCode = 1;
