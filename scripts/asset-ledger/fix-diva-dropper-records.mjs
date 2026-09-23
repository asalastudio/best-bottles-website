#!/usr/bin/env node
/**
 * Repair the 46 ml Diva dropper records on PRODUCTION.
 *
 * Shopify is the commercial truth here, and it is unambiguous:
 *
 *   GB-DVA-CLR-46ML-DRP-CPR  variant 53343643238692  $2.40  46 ml Clear Diva Dropper Bottle
 *   GB-DVA-CLR-46ML-DRP-GLD  variant 53343643205924  $2.40  46 ml Clear Diva Dropper Bottle
 *   GB-DVA-CLR-46ML-DRP-SLV  variant 56214700491044  $2.40  46 ml Clear Diva Dropper Bottle
 *   GB-DVA-FRS-46ML-DRP-CPR  variant 56214700556580  $2.90  46 ml Frosted Diva Dropper Bottle
 *   GB-DVA-FRS-46ML-DRP-GLD  variant 56214700523812  $2.90  46 ml Frosted Diva Dropper Bottle
 *   GB-DVA-FRS-46ML-DRP-SLV  variant 53343642485028  $2.90  46 ml Frosted Diva Dropper Bottle
 *
 * Dev already matches that. Production does not:
 *
 *   1. GBDiva46DrpCu is bound to the CLEAR copper variant but carries the
 *      FROSTED grace SKU.                                   <- fixed here
 *   2. GBDiva46DrpGl, same defect in gold.                  <- fixed here
 *   3. GBDiva46DrpSl is the CLEAR silver dropper — its item name ("bottle with
 *      white dropper with shiny silver collar cap", no "frost"), its $2.40
 *      ladder and its import source all match dev's clear silver record — but
 *      it carries the FROSTED grace SKU, is bound to the FROSTED Shopify
 *      variant ($2.90 in Shopify against $2.40 on the page), sits in the
 *      frosted group and records color "Frosted".
 *   4. The three frosted droppers have no record on production at all, though
 *      Shopify sells all three and Nemat confirmed them (see dev's records).
 *
 * Phases, each independently useful and each dry by default:
 *   grace   (1)(2)(3) grace SKUs, so every record claims the identity its
 *           Shopify variant actually carries. Metadata only.
 *   bind    (3) rebind the clear silver record to the CLEAR variant. This is
 *           the one that stops a clear-labelled page putting a frosted bottle
 *           in the cart.
 *   group   (3) move the clear silver record into the clear dropper group and
 *           take its `color` from that group, which is the only way to correct
 *           the stored "Frosted" on a clear bottle without new backend code.
 *   create  (4) create the three frosted records from their clear twin, with
 *           dev's reconciled commercial fields. Run `bind` again afterwards to
 *           give them their Shopify variants.
 *
 * Run order: grace, create, bind, group.
 *
 *   node scripts/asset-ledger/fix-diva-dropper-records.mjs --phase grace
 *   node scripts/asset-ledger/fix-diva-dropper-records.mjs --phase grace --apply
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";

const PROD_URL = "https://precise-raccoon-123.convex.cloud";
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const phase = args[args.indexOf("--phase") + 1] ?? "grace";
if (!["grace", "bind", "group", "create"].includes(phase)) throw new Error(`unknown --phase ${phase}`);
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
if (apply && !writeToken) throw new Error("BEST_BOTTLES_CONVEX_WRITE_TOKEN is not set");

const V = (id) => `gid://shopify/ProductVariant/${id}`;
const INV = (id) => `gid://shopify/InventoryItem/${id}`;

/** websiteSku -> the grace SKU Shopify says that record's variant carries. */
const GRACE = [
    { websiteSku: "GBDiva46DrpCu", graceSku: "GB-DVA-CLR-46ML-DRP-CPR", expectVariant: V("53343643238692") },
    { websiteSku: "GBDiva46DrpGl", graceSku: "GB-DVA-CLR-46ML-DRP-GLD", expectVariant: V("53343643205924") },
    // the clear silver record, currently wearing the frosted grace SKU and variant
    { websiteSku: "GBDiva46DrpSl", graceSku: "GB-DVA-CLR-46ML-DRP-SLV", expectVariant: V("53343642485028") },
];

/** The variant each grace SKU owns in Shopify, checked there today. */
const BIND = [
    { sku: "GB-DVA-CLR-46ML-DRP-SLV", shopifyVariantId: V("56214700491044"), shopifyInventoryItemId: INV("58246738051364") },
    { sku: "GB-DVA-FRS-46ML-DRP-CPR", shopifyVariantId: V("56214700556580"), shopifyInventoryItemId: INV("58246738116900") },
    { sku: "GB-DVA-FRS-46ML-DRP-GLD", shopifyVariantId: V("56214700523812"), shopifyInventoryItemId: INV("58246738084132") },
    { sku: "GB-DVA-FRS-46ML-DRP-SLV", shopifyVariantId: V("53343642485028"), shopifyInventoryItemId: INV("55366033047844") },
];

const FROSTED_TIERS = [
    { minQty: 1, unitPrice: 2.9, totalPrice: 2.9 },
    { minQty: 12, unitPrice: 2.76, totalPrice: 33.06 },
    { minQty: 144, unitPrice: 2.61, totalPrice: 375.84 },
    { minQty: 300, unitPrice: 2.47, totalPrice: 739.5 },
    { minQty: 1500, unitPrice: 2.26, totalPrice: 3393 },
];
const FROSTED_SOURCE = "Nemat confirms all three frosted Diva droppers sell; price ladder from the frosted copper listing on bestbottles.com large-dropper-bottles.php, 2026-09-02; mirrored from dev 2026-09-18";

/** Exactly the commercial fields dev holds for these three, which match Shopify. */
const CREATE = [
    { websiteSku: "GBDivaFrst46DrpCu", graceSku: "GB-DVA-FRS-46ML-DRP-CPR", capColor: "Copper", collar: "copper" },
    { websiteSku: "GBDivaFrst46DrpGl", graceSku: "GB-DVA-FRS-46ML-DRP-GLD", capColor: "Gold", collar: "gold" },
    { websiteSku: "GBDivaFrst46DrpSl", graceSku: "GB-DVA-FRS-46ML-DRP-SLV", capColor: "Silver", collar: "silver" },
].map((row) => ({
    ...row,
    twinWebsiteSku: "GBDiva46DrpSl",
    groupSlug: "diva-46ml-frosted-18-415-dropper",
    color: "Frosted",
    itemName: `Diva design 46 ml, 1.64oz frost glass bottle with white dropper and shiny ${row.collar} collar cap`,
    itemDescription: `Diva design 46 ml, 1.64oz frost glass bottle with white dropper and shiny ${row.collar} collar cap`,
    priceTiers: FROSTED_TIERS,
    source: FROSTED_SOURCE,
}));

async function main() {
    const prod = new ConvexHttpClient(PROD_URL);
    const results = [];

    if (phase === "grace") {
        for (const fix of GRACE) {
            const product = (await prod.query(api.products.lookupSku, { sku: fix.websiteSku }))?.product ?? null;
            if (!product) { results.push({ sku: fix.websiteSku, outcome: "SKIPPED no product on prod" }); continue; }
            // The variant binding is the evidence of which record this is. If it is
            // not the variant this repair expects, the catalogue moved: do nothing.
            if (product.shopifyVariantId !== fix.expectVariant) {
                results.push({ sku: fix.websiteSku, outcome: `SKIPPED bound to ${product.shopifyVariantId}, expected ${fix.expectVariant}` });
                continue;
            }
            if (product.graceSku === fix.graceSku) { results.push({ sku: fix.websiteSku, outcome: "already correct" }); continue; }
            if (!apply) { results.push({ sku: fix.websiteSku, outcome: `would set ${product.graceSku} -> ${fix.graceSku}` }); continue; }
            const r = await prod.mutation(api.products.setGraceSku, { writeToken, websiteSku: fix.websiteSku, graceSku: fix.graceSku });
            results.push({ sku: fix.websiteSku, outcome: r.changed ? `set ${r.from} -> ${fix.graceSku}` : `refused: ${r.detail}` });
        }
    }

    if (phase === "bind") {
        const patches = [];
        for (const row of BIND) {
            const product = (await prod.query(api.products.lookupSku, { sku: row.sku }))?.product ?? null;
            if (!product) { results.push({ sku: row.sku, outcome: "SKIPPED no record carries this grace SKU yet" }); continue; }
            if (product.shopifyVariantId === row.shopifyVariantId) { results.push({ sku: row.sku, outcome: "already bound" }); continue; }
            results.push({ sku: row.sku, outcome: `${apply ? "rebind" : "would rebind"} ${product.shopifyVariantId} -> ${row.shopifyVariantId}` });
            patches.push(row);
        }
        if (apply && patches.length) {
            const r = await prod.action(api.backfillShopifyIds.applyVariantBatch, { patches, batchIndex: 0 });
            console.log("applyVariantBatch:", JSON.stringify(r));
        }
    }

    if (phase === "group") {
        const product = (await prod.query(api.products.lookupSku, { sku: "GBDiva46DrpSl" }))?.product ?? null;
        if (!product) results.push({ sku: "GBDiva46DrpSl", outcome: "SKIPPED no product" });
        else if (product.graceSku !== "GB-DVA-CLR-46ML-DRP-SLV") results.push({ sku: "GBDiva46DrpSl", outcome: "SKIPPED run --phase grace first" });
        else if (!apply) results.push({ sku: "GBDiva46DrpSl", outcome: `would move to diva-46ml-clear-18-415-dropper and set color from that group (now "${product.color}")` });
        else {
            // setColorFromGroup is what corrects the stored "Frosted" on this clear bottle.
            const r = await prod.mutation(api.products.moveProductToGroup, { writeToken, websiteSku: "GBDiva46DrpSl", groupSlug: "diva-46ml-clear-18-415-dropper", setColorFromGroup: true });
            results.push({ sku: "GBDiva46DrpSl", outcome: JSON.stringify(r) });
        }
    }

    if (phase === "create") {
        for (const row of CREATE) {
            const existing = (await prod.query(api.products.lookupSku, { sku: row.websiteSku }))?.product ?? null;
            if (existing) { results.push({ sku: row.websiteSku, outcome: "already exists" }); continue; }
            if (!apply) { results.push({ sku: row.websiteSku, outcome: `would create in ${row.groupSlug} at $${row.priceTiers[0].unitPrice}` }); continue; }
            const r = await prod.mutation(api.products.createProductFromTwin, {
                writeToken, twinWebsiteSku: row.twinWebsiteSku, websiteSku: row.websiteSku, graceSku: row.graceSku,
                groupSlug: row.groupSlug, color: row.color, capColor: row.capColor, itemName: row.itemName,
                itemDescription: row.itemDescription, priceTiers: row.priceTiers, source: row.source,
            });
            results.push({ sku: row.websiteSku, outcome: r.created ? "created" : `refused: ${r.detail}` });
        }
    }

    for (const r of results) console.log(`${r.sku}: ${r.outcome}`);
    if (apply) {
        const file = `data/asset-ledger/diva-dropper-record-fix-2026-09-18.json`;
        const prior = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { phases: [] };
        prior.phases = [...(prior.phases ?? []), { phase, appliedAt: new Date().toISOString(), deployment: PROD_URL, evidence: "Shopify Admin API variant titles, SKUs and prices, read 2026-09-18", results }];
        writeFileSync(file, JSON.stringify(prior, null, 1) + "\n");
        console.log(`receipt: ${file}`);
    } else {
        console.log(`\nDRY RUN (--phase ${phase}). Re-run with --apply to write.`);
    }
}

main().catch((error) => { console.error(error); process.exit(1); });
