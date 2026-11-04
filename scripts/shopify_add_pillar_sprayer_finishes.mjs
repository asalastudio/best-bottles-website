#!/usr/bin/env node
/**
 * The Shopify variants for the six Pillar 9 ml sprayer finishes (Jordan, 4 Nov 2026: "Yes, all of it"), added to the
 * product that holds the matte black one (pillar-9ml-clear-17-415-finemist), with matte black's settings and the old
 * site's $0.97. The catalogue rows exist first (scripts/catalog-corrections/2026-11-04-pillar-sprayer-finishes.mjs), so
 * the webhook sync links each by its Grace SKU, as scripts/shopify_add_elegant100_frosted_mtsl.mjs did.
 * Stock is not tracked (this key has no write_inventory), which the site reads as In Stock.
 *
 *   node scripts/shopify_add_pillar_sprayer_finishes.mjs            # dry run (reads only)
 *   node scripts/shopify_add_pillar_sprayer_finishes.mjs --apply
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(resolve(REPO, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
}
const domain = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const token = process.env.SHOPIFY_ADMIN_TOKEN;
if (!domain || !token) { console.error("NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN must be set in .env.local"); process.exit(1); }
const APPLY = process.argv.includes("--apply");
const TWIN_VARIANT = "53343699206436";   // GBPillar9SpryBlkMatt · GB-PIL-CLR-9ML-SPR-MBLK
const PRICE = "0.97";
const SKUS = ["GB-PIL-CLR-9ML-SPR-SBLK", "GB-PIL-CLR-9ML-SPR-MBLU", "GB-PIL-CLR-9ML-SPR-MGLD", "GB-PIL-CLR-9ML-SPR-SGLD",
    "GB-PIL-CLR-9ML-SPR-MSLV", "GB-PIL-CLR-9ML-SPR-SSLV"];

async function rest(method, path, body) {
    const r = await fetch(`https://${domain}/admin/api/2025-01/${path}`, {
        method, headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${JSON.stringify(j).slice(0, 400)}`);
    return j;
}

const { variant: twin } = await rest("GET", `variants/${TWIN_VARIANT}.json`);
const { product } = await rest("GET", `products/${twin.product_id}.json?fields=id,title,handle,options,variants`);
console.log(`${APPLY ? "APPLY" : "DRY RUN"}: ${product.title} [${product.handle}], options ${product.options.map(o => o.name).join("/")}, ${product.variants.length} variants`);
if (product.handle !== "pillar-9ml-clear-17-415-finemist") throw new Error("the twin is not on the Pillar sprayer product");
if (product.options.length !== 1) throw new Error("expected a single option (SKU) on this product");
if (twin.price !== PRICE) throw new Error(`matte black is $${twin.price}, not $${PRICE}`);
const record = [];
for (const sku of SKUS) {
    if (product.variants.some(v => v.sku === sku || v.option1 === sku)) { console.log(`  ${sku} already on this product`); continue; }
    const variant = {
        option1: sku, sku, price: PRICE, compare_at_price: twin.compare_at_price, barcode: null, taxable: twin.taxable,
        requires_shipping: twin.requires_shipping, weight: twin.weight, weight_unit: twin.weight_unit,
        inventory_management: null, inventory_policy: "deny", fulfillment_service: "manual",
    };
    console.log(`  ${APPLY ? "adding" : "would add"} ${sku} at $${PRICE} (twin ${twin.sku} at $${twin.price})`);
    if (!APPLY) continue;
    const { variant: created } = await rest("POST", `products/${product.id}/variants.json`, { variant });
    record.push({ variant: created.id, sku: created.sku, price: created.price });
    console.log(`  added variant ${created.id} (${created.sku}, $${created.price})`);
}
if (APPLY && record.length) {
    const dir = resolve(REPO, "data/audits/shopify-pillar-sprayer-finishes");
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, "record.json"), JSON.stringify({ at: new Date().toISOString(), product: product.id, handle: product.handle, added: record }, null, 1) + "\n");
}
