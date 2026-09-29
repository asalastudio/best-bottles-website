#!/usr/bin/env node
/**
 * Split the tassel bulb sprayers out of the five Shopify products that sell them under a plain name
 * (Jordan, 2026-09-29: "split in two, bulbs and bulbs with tassel are different").
 *
 * Five products hold 31 tassel bottles beside the plain ones: 100 ml Frosted Circle, 128 ml Frosted Round, 50 ml
 * Clear Circle, 50 ml Frosted Circle and 60 ml Clear Elegant. Production's catalogue says which variants are tassel
 * sprayers (applicator "Vintage Bulb Sprayer with Tassel"). Each one gets a variant, with its own SKU, price and
 * option, under the product whose handle is the catalogue's tassel page ("<plain handle>-tassel"). That product
 * already exists for three of the five; for Round Frosted 128 and Circle Frosted 50 it is created, active and
 * published, with the site's name ("… Vintage-Style Bulb Sprayer Bottle with Tassel").
 *
 * Shopify cannot move a variant, so the old one stays behind with "-MOVED-TO-TASSEL" added to its SKU, done FIRST so
 * the webhook sync (convex/shopifySync.ts, matching by SKU) can only ever link the catalogue to the new variant.
 * Nothing is deleted: the 31 renamed variants are for Jordan to delete in Shopify admin. Saved carts that still
 * hold an old variant id keep working until then, and resolve by SKU afterwards (/api/shopify/resolve-variants).
 *
 * Stock: the old variants track a placeholder 1000 with "deny". This key has no write_inventory scope, so the new
 * variants do not track stock (always available), which the site reads as "In Stock".
 *
 *   node scripts/shopify_split_tassel_products.mjs            # dry run
 *   node scripts/shopify_split_tassel_products.mjs --apply    # idempotent: skips renamed SKUs and variants that exist
 *
 * Every write goes to data/audits/shopify-tassel-split/record-<time>.json as it happens.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(resolve(REPO, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
}
const PROD_URL = "https://precise-raccoon-123.convex.cloud";
const domain = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const token = process.env.SHOPIFY_ADMIN_TOKEN;
if (!domain || !token) { console.error("NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN must be set in .env.local"); process.exit(1); }
const APPLY = process.argv.includes("--apply");
const SUFFIX = "-MOVED-TO-TASSEL";
const PLAIN_HANDLES = [
    "circle-100ml-frosted-18-415-antiquespray",
    "round-128ml-frosted-18-415-antiquespray",
    "circle-50ml-clear-18-415-antiquespray",
    "circle-50ml-frosted-18-415-antiquespray",
    "elegant-60ml-clear-18-415-antiquespray",
];
const DIR = resolve(REPO, "data/audits/shopify-tassel-split");
mkdirSync(DIR, { recursive: true });
const recordFile = resolve(DIR, `record-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
const record = [];
const log = (entry) => { record.push({ at: new Date().toISOString(), ...entry }); if (APPLY) writeFileSync(recordFile, JSON.stringify(record, null, 1) + "\n"); };

async function rest(method, path, body) {
    for (let attempt = 1; attempt <= 5; attempt++) {
        const r = await fetch(`https://${domain}/admin/api/2025-01/${path}`, {
            method, headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: body ? JSON.stringify(body) : undefined,
        });
        if (r.status === 429) { await new Promise(s => setTimeout(s, 1500 * attempt)); continue; }
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${JSON.stringify(j).slice(0, 400)}`);
        return j;
    }
    throw new Error("rate limited");
}
const byHandle = async (handle) => (await rest("GET", `products.json?handle=${encodeURIComponent(handle)}&fields=id,title,handle,status,product_type,vendor,tags,published_at,published_scope,options,variants`)).products?.find(p => p.handle === handle) ?? null;
const pause = () => new Promise(s => setTimeout(s, 600));

// Which variants are tassel sprayers: production's catalogue, by Shopify variant id.
const convex = new ConvexHttpClient(PROD_URL);
const rows = new Map();
for (let cursor = null; ;) {
    const page = await convex.action(anyApi.products.getProductExportPage, { cursor, numItems: 500 });
    for (const r of page.page) if (r.shopifyVariantId) rows.set(r.shopifyVariantId.split("/").pop(), r);
    if (page.isDone) break;
    cursor = page.continueCursor;
}

console.log(APPLY ? "APPLY" : "DRY RUN");
for (const plainHandle of PLAIN_HANDLES) {
    const plain = await byHandle(plainHandle);
    if (!plain) { console.log(`  ${plainHandle}: no such Shopify product, skipped`); continue; }
    const tassel = plain.variants.filter(v => (v.sku ?? "").endsWith(SUFFIX) || /Tassel/.test(rows.get(String(v.id))?.applicator ?? ""));
    const targetHandle = `${plainHandle}-tassel`;
    let target = await byHandle(targetHandle);
    console.log(`== ${plain.title}: ${tassel.length} tassel variants → ${target ? `existing ${targetHandle} (${target.variants.length} variants)` : `NEW ${targetHandle}`}`);
    if (!tassel.length) continue;

    // 1. The old variant's SKU first, so no sync can link the catalogue back to it.
    for (const v of tassel) {
        const sku = v.sku ?? "";
        if (sku.endsWith(SUFFIX)) continue;
        if (!APPLY) { console.log(`  would rename old ${sku} → ${sku}${SUFFIX}`); continue; }
        await rest("PUT", `variants/${v.id}.json`, { variant: { id: v.id, sku: `${sku}${SUFFIX}` } });
        log({ step: "rename-old", product: plain.id, variant: v.id, from: sku, to: `${sku}${SUFFIX}` });
        v.sku = `${sku}${SUFFIX}`;
        await pause();
    }

    // 2. The new variants, under the tassel product (created when there is none).
    const fields = (v) => ({
        option1: v.option1, sku: v.sku.replace(SUFFIX, ""), price: v.price, compare_at_price: v.compare_at_price, barcode: v.barcode,
        taxable: v.taxable, requires_shipping: v.requires_shipping, weight: v.weight, weight_unit: v.weight_unit,
        inventory_management: null, inventory_policy: "deny", fulfillment_service: "manual",
    });
    if (!target) {
        const title = `${plain.title.replace(/ with Tassel$/, "")} with Tassel`;
        if (!APPLY) { console.log(`  would create "${title}" [${targetHandle}] with ${tassel.length} variants (active, published)`); continue; }
        const { product } = await rest("POST", "products.json", { product: {
            title, handle: targetHandle, product_type: plain.product_type, vendor: plain.vendor, tags: plain.tags, status: "active",
            published: true, published_scope: plain.published_scope || "web", options: [{ name: plain.options?.[0]?.name ?? "SKU" }], variants: tassel.map(fields),
        } });
        if (product.handle !== targetHandle) throw new Error(`created ${product.id} with handle ${product.handle}, not ${targetHandle}: check before re-running`);
        log({ step: "create-product", product: product.id, handle: product.handle, title: product.title, variants: product.variants.map(x => ({ id: x.id, sku: x.sku })) });
        console.log(`  created ${product.title} (${product.variants.length} variants)`);
        await pause();
        continue;
    }
    for (const v of tassel) {
        const f = fields(v);
        if (target.variants.some(x => x.sku === f.sku)) { console.log(`  ${f.sku} already on ${targetHandle}`); continue; }
        if (!APPLY) { console.log(`  would add ${f.sku} (${f.option1}, $${f.price}) to ${targetHandle}`); continue; }
        const { variant } = await rest("POST", `products/${target.id}/variants.json`, { variant: f });
        log({ step: "add-variant", product: target.id, handle: targetHandle, variant: variant.id, sku: variant.sku, from: v.id });
        console.log(`  added ${variant.sku} to ${targetHandle}`);
        await pause();
    }
}
if (APPLY) console.log(`record: ${recordFile.replace(REPO + "/", "")}`);
