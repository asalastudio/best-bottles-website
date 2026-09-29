#!/usr/bin/env node
/**
 * The Shopify variant for GBElgFrst100RdcrMtSl (frosted Elegant 100 reducer, short matte silver cap; Jordan
 * 2026-09-29), added to the product that holds its siblings, next to the twin GBElgFrst100RdcrShnSl, with the
 * twin's settings and the approved $2.77. The catalogue row exists first
 * (scripts/catalog-corrections/2026-09-29-elegant-100-frosted-matte-silver.mjs), so the webhook sync links it by
 * SKU. Stock is not tracked (this key has no write_inventory), which the site reads as In Stock.
 *
 *   node scripts/shopify_add_elegant100_frosted_mtsl.mjs            # dry run
 *   node scripts/shopify_add_elegant100_frosted_mtsl.mjs --apply
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
const TWIN_VARIANT = "53343641010468";   // GBElgFrst100RdcrShnSl · GB-ELG-FRS-100ML-RDC-SSLV
const SKU = "GB-ELG-FRS-100ML-RDC-MSLV";
const PRICE = "2.77";

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
if (product.options.length !== 1) throw new Error("expected a single option (SKU) on this product");
if (product.variants.some(v => v.sku === SKU || v.option1 === SKU)) { console.log(`  ${SKU} already on this product: nothing to do`); process.exit(0); }
const variant = {
    option1: SKU, sku: SKU, price: PRICE, compare_at_price: twin.compare_at_price, barcode: null, taxable: twin.taxable,
    requires_shipping: twin.requires_shipping, weight: twin.weight, weight_unit: twin.weight_unit,
    inventory_management: null, inventory_policy: "deny", fulfillment_service: "manual",
};
console.log(`  ${APPLY ? "adding" : "would add"} ${SKU} at $${PRICE} (twin ${twin.sku} at $${twin.price})`);
if (!APPLY) process.exit(0);
const { variant: created } = await rest("POST", `products/${product.id}/variants.json`, { variant });
const dir = resolve(REPO, "data/audits/shopify-elegant100-frosted-mtsl");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "record.json"), JSON.stringify({ at: new Date().toISOString(), product: product.id, handle: product.handle, variant: created.id, sku: created.sku, price: created.price }, null, 1) + "\n");
console.log(`  added variant ${created.id} (${created.sku}, $${created.price})`);
