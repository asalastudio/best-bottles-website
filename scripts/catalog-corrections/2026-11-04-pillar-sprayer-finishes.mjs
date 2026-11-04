#!/usr/bin/env node
/**
 * 2026-11-04 — the Pillar 9 ml spray bottle in all seven sprayer finishes (Jordan: "fix this and make complete").
 *
 * bestbottles.com sells seven Pillar sprayers (pillar-design-5-ml-glass-bottle-<finish>-spray: matte black, shiny black,
 * matte blue, shiny gold, matte gold, matte silver, shiny silver), all 13-415, 78 mm with cap, 21 mm wide, one ladder:
 * 1+ $0.97, 12+ $0.92, 144+ $0.87, 526+ $0.82, 2630+ $0.76 (the old site's own totals below). The catalogue and Shopify
 * have only GBPillar9SpryBlkMatt (GB-PIL-CLR-9ML-SPR-MBLK, Shopify product pillar-9ml-clear-17-415-finemist), and its
 * row carries no ladder, so its page offers only "Set of 1".
 *
 * This creates the six missing rows on that page with products:createProductFromTwin (twin GBPillar9SpryBlkMatt: same
 * glass, neck, sizes, case pack and component list), each named for its own finish (capColor, trimColor, names and
 * Grace description), Grace SKUs in the Cylinder and Sleek sprayer pattern (SBLK, MBLU, MGLD, SGLD, MSLV, SSLV).
 * New rows start quote-only (NOT_IN_SHOPIFY) until their Shopify variants exist and the webhook sync links them.
 * Not done here: the matte black row's ladder (Team Hub price editor or a separate guarded step), the Shopify variants.
 *
 *   node scripts/catalog-corrections/2026-11-04-pillar-sprayer-finishes.mjs            # dry run, dev (writes nothing)
 *   node scripts/catalog-corrections/2026-11-04-pillar-sprayer-finishes.mjs --apply    # write, dev
 *   node scripts/catalog-corrections/2026-11-04-pillar-sprayer-finishes.mjs --prod [--apply]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const DEV_URL = "https://helpful-elephant-638.convex.cloud";   // explicit: this checkout's .env.local may point at prod
const prod = process.argv.includes("--prod");
const apply = process.argv.includes("--apply");
const url = prod ? PROD_URL : DEV_URL;
const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
if (apply && !writeToken) { console.error("BEST_BOTTLES_CONVEX_WRITE_TOKEN must be set in .env.local to apply"); process.exit(1); }

const TWIN = "GBPillar9SpryBlkMatt";
const PAGE = "pillar-9ml-clear-17-415-finemist";
// The old site's ladder, totals as it prints them.
const LADDER = [
    { minQty: 1, unitPrice: 0.97, totalPrice: 0.97 },
    { minQty: 12, unitPrice: 0.92, totalPrice: 11.06 },
    { minQty: 144, unitPrice: 0.87, totalPrice: 125.71 },
    { minQty: 526, unitPrice: 0.82, totalPrice: 433.69 },
    { minQty: 2630, unitPrice: 0.76, totalPrice: 1989.86 },
];
const FINISHES = [
    { sku: "GBPillar9SpryBlkShn", grace: "GB-PIL-CLR-9ML-SPR-SBLK", color: "Shiny Black", words: "shiny black" },
    { sku: "GBPillar9SpryBluMatt", grace: "GB-PIL-CLR-9ML-SPR-MBLU", color: "Matte Blue", words: "matte blue" },
    { sku: "GBPillar9SpryGlMatt", grace: "GB-PIL-CLR-9ML-SPR-MGLD", color: "Matte Gold", words: "matte gold" },
    { sku: "GBPillar9SpryGlShn", grace: "GB-PIL-CLR-9ML-SPR-SGLD", color: "Shiny Gold", words: "shiny gold" },
    { sku: "GBPillar9SprySlMatt", grace: "GB-PIL-CLR-9ML-SPR-MSLV", color: "Matte Silver", words: "matte silver" },
    { sku: "GBPillar9SprySlShn", grace: "GB-PIL-CLR-9ML-SPR-SSLV", color: "Shiny Silver", words: "shiny silver" },
];

const client = new ConvexHttpClient(url);
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}`);
const page = await client.query(anyApi.products.getProductGroup, { slug: PAGE });
if (!page) { console.error(`  ${PAGE} does not exist here`); process.exit(1); }
const twin = page.variants.find(v => v.websiteSku === TWIN);
if (!twin) { console.error(`  twin ${TWIN} is not on ${PAGE}`); process.exit(1); }
if (twin.capColor !== "Matte Black" || twin.neckThreadSize !== "13-415" || twin.capacityMl !== 9) {
    console.error(`  twin changed since this plan was written: ${JSON.stringify({ capColor: twin.capColor, neck: twin.neckThreadSize, ml: twin.capacityMl })}`); process.exit(1);
}
const rename = (text, words) => {
    if (typeof text !== "string" || (text.match(/matte black spray/g) ?? []).length !== 1) throw new Error(`expected "matte black spray" once in: ${text}`);
    return text.replace("matte black spray", `${words} spray`);
};
const plan = [];
for (const f of FINISHES) {
    if (page.variants.some(v => v.websiteSku === f.sku)) { plan.push({ websiteSku: f.sku, action: "exists" }); continue; }
    const args = {
        writeToken: writeToken ?? "", twinWebsiteSku: TWIN, websiteSku: f.sku, graceSku: f.grace, groupSlug: PAGE,
        color: twin.color, capColor: f.color, trimColor: f.color,
        graceDescription: rename(twin.graceDescription, f.words),
        itemName: rename(twin.itemName, f.words), itemDescription: rename(twin.itemDescription ?? twin.itemName, f.words),
        priceTiers: LADDER,
        source: `2026-11-04 Jordan: Pillar 9 ml in all seven sprayer finishes (bestbottles.com pillar-design-5-ml-glass-bottle-${f.words.replace(" ", "-")}-spray; twin ${TWIN})`,
    };
    plan.push({ websiteSku: f.sku, action: apply ? "create" : "would create", graceSku: f.grace, capColor: f.color,
        graceDescription: args.graceDescription, itemName: args.itemName, ladder: LADDER.map(t => `${t.minQty}+ $${t.unitPrice}`).join(", ") });
    if (apply) {
        const result = await client.mutation(anyApi.products.createProductFromTwin, args);
        plan[plan.length - 1].result = result;
        if (!result.created) process.exitCode = 1;
    }
}
for (const row of plan) console.log(`  ${row.action.padEnd(12)} ${row.websiteSku} ${row.graceSku ?? ""} ${row.capColor ?? ""}${row.result ? " → " + row.result.detail : ""}`);
console.log(`  twin ladder now: ${JSON.stringify(twin.priceTiers ?? null)} (old site: ${LADDER.map(t => `${t.minQty}+ $${t.unitPrice}`).join(", ")})`);
const out = resolve(ROOT, "docs/reviews/pillar-masters-2026-11-04");
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, `catalog-plan-${prod ? "prod" : "dev"}${apply ? "-applied" : ""}.json`),
    JSON.stringify({ at: new Date().toISOString(), deployment: prod ? "prod" : "dev", apply, page: PAGE, twin: TWIN, ladder: LADDER, plan }, null, 2) + "\n");
