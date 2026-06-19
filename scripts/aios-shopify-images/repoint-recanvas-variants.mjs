#!/usr/bin/env node
/**
 * Remediation for the failed recanvas push (apply #1, 2026-06-17).
 *
 * push-shopify-pdp-media.mjs --replace uploaded 111 on-brand renders into 26
 * product galleries but could not attach them: Shopify's
 * productVariantAppendMedia rejects variants that already have media. This
 * script REUSES the already-uploaded media and repoints each variant to it via
 * productVariantsBulkUpdate (which replaces the variant's image association),
 * then patches Convex `imageUrl` for the repointed SKUs.
 *
 * Match rule: a product media whose filename is exactly `<variantSku>.png`
 * (the clean recanvas naming) and status READY. Old media carry a
 * `_<digits>_<hash>.png` suffix and are never matched.
 *
 * Dry-run by default. Scope with --handle <productHandle> (the test path) or
 * --all (every product that contains a manifest SKU).
 *
 * Env (.env.local): NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_TOKEN,
 * NEXT_PUBLIC_CONVEX_URL, BEST_BOTTLES_CONVEX_WRITE_TOKEN.
 *
 * Usage:
 *   node scripts/aios-shopify-images/repoint-recanvas-variants.mjs --handle circle-100ml-frosted-18-415-reducer
 *   node scripts/aios-shopify-images/repoint-recanvas-variants.mjs --handle circle-100ml-frosted-18-415-reducer --apply
 *   node scripts/aios-shopify-images/repoint-recanvas-variants.mjs --all --apply
 *   node scripts/aios-shopify-images/repoint-recanvas-variants.mjs --all --apply --convex-url https://precise-raccoon-123.convex.cloud --no-shopify
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const API_VERSION = "2025-01";
const DEFAULT_MANIFEST = resolve(ROOT, "data/audits/image-generation-coverage-2026-06-18-postgen/recanvas_publish_manifest.csv");

function loadEnv() {
    try {
        for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
            const m = line.match(/^([^#=]+)=(.*)$/);
            if (m && process.env[m[1].trim()] == null) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
        }
    } catch { /* optional */ }
}
loadEnv();

const argVal = (n) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : undefined; };
const APPLY = process.argv.includes("--apply");
const ALL = process.argv.includes("--all");
const HANDLE = argVal("--handle");
const NO_SHOPIFY = process.argv.includes("--no-shopify");
const NO_CONVEX = process.argv.includes("--no-convex");
const MANIFEST = argVal("--manifest") ?? DEFAULT_MANIFEST;
const CONVEX_URL = argVal("--convex-url") ?? process.env.NEXT_PUBLIC_CONVEX_URL;
const WRITE_TOKEN = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
const DOMAIN = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

if (!HANDLE && !ALL) { console.error("Specify --handle <productHandle> or --all"); process.exit(1); }
if (!DOMAIN || !TOKEN) { console.error("Missing Shopify env"); process.exit(1); }
if (APPLY && !NO_CONVEX && !WRITE_TOKEN) { console.error("Missing BEST_BOTTLES_CONVEX_WRITE_TOKEN for Convex patch"); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gql(query, variables, attempt = 0) {
    const res = await fetch(`https://${DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": TOKEN },
        body: JSON.stringify({ query, variables }),
    });
    const text = await res.text();
    if ((res.status === 429) && attempt < 5) { await sleep(1500 * (attempt + 1)); return gql(query, variables, attempt + 1); }
    if (!res.ok) throw new Error(`Shopify HTTP ${res.status}: ${text.slice(0, 300)}`);
    const json = JSON.parse(text);
    if (json.errors?.length) {
        if (json.errors.some((e) => e.extensions?.code === "THROTTLED") && attempt < 5) { await sleep(2000 * (attempt + 1)); return gql(query, variables, attempt + 1); }
        throw new Error(`GraphQL: ${json.errors.map((e) => e.message).join("; ")}`);
    }
    return json.data;
}

function parseCsv(text) {
    const rows = []; let row = [], f = "", q = false;
    for (let i = 0; i < text.length; i++) { const c = text[i];
        if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
        else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; }
        else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); f = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = []; }
        else f += c; }
    if (f !== "" || row.length) { row.push(f); rows.push(row); }
    const [h, ...b] = rows; return b.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ""])));
}

const cleanName = (url) => (url || "").split("?")[0].split("/").pop() || "";
const versionOf = (url) => { const m = (url || "").match(/[?&]v=(\d+)/); return m ? Number(m[1]) : 0; };

async function fetchProductByHandle(handle) {
    const d = await gql(`query($h:String!){ productByHandle(handle:$h){ id title handle
        variants(first:250){ nodes{ id sku image{ id url } } }
        media(first:250){ nodes{ ... on MediaImage { id status image{ url } } } } } }`, { h: handle });
    return d.productByHandle;
}

async function fetchVariantsBySkus(skus) {
    // returns map sku -> { variantId, productId, handle }
    const out = new Map(); const products = new Set();
    let cursor = null;
    const wanted = new Set(skus);
    const query = `query($first:Int!,$after:String){ productVariants(first:$first, after:$after){ edges{ cursor node{ id sku product{ id handle } } } pageInfo{ hasNextPage endCursor } } }`;
    while (true) {
        const d = await gql(query, { first: 250, after: cursor });
        for (const e of d.productVariants.edges) { const n = e.node; if (n.sku && wanted.has(n.sku)) { out.set(n.sku, { variantId: n.id, productId: n.product.id, handle: n.product.handle }); products.add(n.product.handle); } }
        if (!d.productVariants.pageInfo.hasNextPage) break;
        cursor = d.productVariants.pageInfo.endCursor;
    }
    return { bySku: out, handles: [...products] };
}

async function bulkUpdate(productId, variants) {
    const d = await gql(`mutation($productId:ID!,$variants:[ProductVariantsBulkInput!]!){
        productVariantsBulkUpdate(productId:$productId, variants:$variants){ productVariants{ id sku image{ url } } userErrors{ field message } } }`,
        { productId, variants });
    const p = d.productVariantsBulkUpdate;
    if (p.userErrors?.length) throw new Error(p.userErrors.map((e) => `${(e.field || []).join(".")}: ${e.message}`).join("; "));
    return p.productVariants;
}

async function planForProduct(product) {
    const media = (product.media?.nodes ?? []).filter((m) => m && m.image?.url);
    const variants = product.variants?.nodes ?? [];
    // newest clean media per sku
    const cleanBySku = new Map();
    for (const m of media) {
        const name = cleanName(m.image.url);
        const sku = name.replace(/\.png$/i, "");
        if (`${sku}.png` !== name) continue; // must be exact clean name
        const prev = cleanBySku.get(sku);
        if (!prev || versionOf(m.image.url) >= versionOf(prev.image.url)) cleanBySku.set(sku, m);
    }
    const items = [];
    for (const v of variants) {
        if (!v.sku) continue;
        const m = cleanBySku.get(v.sku);
        if (!m) continue;
        if (m.status !== "READY") { items.push({ sku: v.sku, skip: `media ${m.status}` }); continue; }
        // Convex always targets the clean media URL (idempotent). Shopify repoint
        // only runs when the variant isn't already pointed at that media — so a
        // second pass (e.g. prod Convex) still patches Convex without re-touching Shopify.
        const shopifyPointed = v.image?.url && cleanName(v.image.url) === `${v.sku}.png`;
        items.push({ sku: v.sku, variantId: v.id, mediaId: m.id, newUrl: m.image.url, shopifyPointed });
    }
    return { productId: product.id, handle: product.handle, title: product.title, items };
}

async function main() {
    let handles = [];
    if (HANDLE) handles = [HANDLE];
    else {
        const rows = parseCsv(readFileSync(MANIFEST, "utf8"));
        const skus = rows.map((r) => r.graceSku).filter(Boolean);
        const { handles: h } = await fetchVariantsBySkus(skus);
        handles = h;
    }

    const convex = (!NO_CONVEX) ? new ConvexHttpClient(CONVEX_URL) : null;
    const summary = { mode: APPLY ? "apply" : "dry-run", convexUrl: NO_CONVEX ? null : CONVEX_URL, products: handles.length, repointed: 0, convexPatched: 0, skipped: 0, failed: 0, details: [] };

    for (const handle of handles) {
        const product = await fetchProductByHandle(handle);
        if (!product) { summary.details.push({ handle, error: "product-not-found" }); summary.failed++; continue; }
        const plan = await planForProduct(product);
        const matched = plan.items.filter((i) => i.variantId);          // all variants with a clean media
        const toRepoint = matched.filter((i) => !i.shopifyPointed);     // Shopify bulkUpdate needed
        const toPatch = convex ? matched : [];                          // Convex patch (idempotent) for all matched
        const skips = plan.items.filter((i) => i.skip);
        summary.skipped += skips.length;
        const entry = { handle, title: plan.title, shopifyRepoint: toRepoint.map((i) => i.sku), convexPatch: toPatch.map((i) => i.sku), skipped: skips };

        if (!APPLY) { summary.details.push(entry); summary.repointed += toRepoint.length; continue; }

        if (!NO_SHOPIFY && toRepoint.length) {
            try {
                await bulkUpdate(plan.productId, toRepoint.map((i) => ({ id: i.variantId, mediaId: i.mediaId })));
                summary.repointed += toRepoint.length;
                entry.repointed = true;
            } catch (e) { entry.shopifyError = String(e.message ?? e); summary.failed++; summary.details.push(entry); continue; }
        } else if (NO_SHOPIFY) { entry.note = "shopify skipped (--no-shopify)"; }

        if (convex) {
            for (const i of toPatch) {
                try {
                    const r = await convex.mutation(api.products.setVariantImages, { websiteSku: i.sku, imageUrl: i.newUrl, writeToken: WRITE_TOKEN });
                    if (r?.success === false) entry[`convex_${i.sku}`] = r.error; else summary.convexPatched++;
                } catch (e) { entry[`convex_${i.sku}`] = String(e.message ?? e); }
            }
        }
        summary.details.push(entry);
        await sleep(250);
    }

    console.log(JSON.stringify(summary, null, 2));
    if (!APPLY) console.log("\nDry-run only. Re-run with --apply to repoint variants + patch Convex.");
}

main().catch((e) => { console.error(e); process.exit(1); });
