#!/usr/bin/env node
/**
 * Backfill Convex product image truth from explicit Shopify variant media.
 *
 * This intentionally does NOT infer media from Shopify product galleries. A
 * SKU is patched only when Shopify has a variant-level image assigned to the
 * same Grace/Shopify SKU. Dry-run by default.
 *
 * Usage:
 *   node scripts/backfill_convex_shopify_variant_media.mjs
 *   node scripts/backfill_convex_shopify_variant_media.mjs --family Cylinder
 *   node scripts/backfill_convex_shopify_variant_media.mjs --family Cylinder --limit 25
 *   node scripts/backfill_convex_shopify_variant_media.mjs --family Cylinder --apply --limit 25
 *   node scripts/backfill_convex_shopify_variant_media.mjs --json > media-backfill-report.json
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const API_VERSION = "2025-01";

function loadEnv() {
    try {
        const content = readFileSync(resolve(ROOT, ".env.local"), "utf8");
        for (const line of content.split("\n")) {
            const match = line.match(/^([^#=]+)=(.*)$/);
            if (!match) continue;
            const key = match[1].trim();
            if (process.env[key] == null) {
                process.env[key] = match[2].trim().replace(/^["']|["']$/g, "");
            }
        }
    } catch {
        // Optional in CI.
    }
}

function argValue(name) {
    const index = process.argv.indexOf(name);
    if (index < 0) return undefined;
    const value = process.argv[index + 1];
    return value && !value.startsWith("--") ? value : undefined;
}

function normalizeUrl(value) {
    if (!value) return null;
    try {
        const url = new URL(value);
        url.searchParams.delete("v");
        return url.toString();
    } catch {
        return String(value);
    }
}

function host(value) {
    try {
        return new URL(value).hostname;
    } catch {
        return null;
    }
}

function isShopifyCdn(value) {
    return host(value) === "cdn.shopify.com";
}

function patchReason(productImageUrl, shopifyImageUrl) {
    if (!shopifyImageUrl) return null;
    if (!productImageUrl) return "missing_convex_image";
    if (!isShopifyCdn(productImageUrl)) return "replace_non_shopify_image";
    if (normalizeUrl(productImageUrl) !== normalizeUrl(shopifyImageUrl)) return "replace_stale_shopify_image";
    return null;
}

loadEnv();

const FAMILY = argValue("--family");
const LIMIT = Number(argValue("--limit") ?? "0");
const APPLY = process.argv.includes("--apply");
const JSON_MODE = process.argv.includes("--json");
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const SHOPIFY_DOMAIN = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const WRITE_TOKEN = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;

const missing = [
    !CONVEX_URL ? "NEXT_PUBLIC_CONVEX_URL" : "",
    !SHOPIFY_DOMAIN ? "NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN" : "",
    !SHOPIFY_TOKEN ? "SHOPIFY_ADMIN_TOKEN" : "",
    APPLY && !WRITE_TOKEN ? "BEST_BOTTLES_CONVEX_WRITE_TOKEN" : "",
].filter(Boolean);

if (missing.length) {
    console.error(`Missing required env: ${missing.join(", ")}`);
    process.exit(1);
}

async function shopifyGraphQL(query, variables) {
    const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": SHOPIFY_TOKEN,
        },
        body: JSON.stringify({ query, variables }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Shopify HTTP ${res.status}: ${text.slice(0, 500)}`);
    const json = JSON.parse(text);
    if (json.errors?.length) {
        throw new Error(`Shopify GraphQL: ${json.errors.map((error) => error.message).join("; ")}`);
    }
    return json.data;
}

async function fetchConvexProducts(convex) {
    const products = [];
    let cursor = null;

    while (true) {
        const result = await convex.action(api.products.getProductExportPage, {
            cursor,
            numItems: 250,
        });
        for (const product of result.page) {
            if (!FAMILY || product.family === FAMILY) products.push(product);
        }
        if (result.isDone) return products;
        cursor = result.continueCursor;
    }
}

async function fetchShopifyVariants() {
    const variants = [];
    let cursor = null;
    const query = `
      query ProductVariants($first: Int!, $after: String, $query: String) {
        productVariants(first: $first, after: $after, query: $query) {
          edges {
            cursor
            node {
              id
              sku
              title
              image { id url altText }
              product { id title handle }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
    const shopifyQuery = FAMILY ? `product_type:${FAMILY}` : undefined;

    while (true) {
        const data = await shopifyGraphQL(query, { first: 250, after: cursor, query: shopifyQuery });
        for (const edge of data.productVariants.edges) variants.push(edge.node);
        if (!data.productVariants.pageInfo.hasNextPage) return variants;
        cursor = data.productVariants.pageInfo.endCursor;
    }
}

async function main() {
    const convex = new ConvexHttpClient(CONVEX_URL);
    const [convexProducts, shopifyVariants] = await Promise.all([
        fetchConvexProducts(convex),
        fetchShopifyVariants(),
    ]);

    const variantBySku = new Map();
    const duplicateShopifySkus = new Map();
    for (const variant of shopifyVariants) {
        if (!variant.sku) continue;
        if (variantBySku.has(variant.sku)) {
            const existing = duplicateShopifySkus.get(variant.sku) ?? [variantBySku.get(variant.sku)];
            existing.push(variant);
            duplicateShopifySkus.set(variant.sku, existing);
            continue;
        }
        variantBySku.set(variant.sku, variant);
    }
    for (const sku of duplicateShopifySkus.keys()) {
        variantBySku.delete(sku);
    }

    const patches = [];
    const skippedMissingShopifyImage = [];
    const skippedUnmatchedShopifySku = [];
    const skippedDuplicateShopifySku = [];

    for (const product of convexProducts) {
        if (!product?.graceSku || !product?.websiteSku) continue;
        if (duplicateShopifySkus.has(product.graceSku)) {
            skippedDuplicateShopifySku.push({
                websiteSku: product.websiteSku,
                graceSku: product.graceSku,
                family: product.family,
                shopifyVariantIds: duplicateShopifySkus.get(product.graceSku).map((variant) => variant.id),
            });
            continue;
        }

        const shopifyVariant = variantBySku.get(product.graceSku);
        if (!shopifyVariant) {
            skippedUnmatchedShopifySku.push({
                websiteSku: product.websiteSku,
                graceSku: product.graceSku,
                family: product.family,
            });
            continue;
        }

        const shopifyImageUrl = shopifyVariant.image?.url ?? null;
        if (!shopifyImageUrl) {
            skippedMissingShopifyImage.push({
                websiteSku: product.websiteSku,
                graceSku: product.graceSku,
                family: product.family,
                productHandle: shopifyVariant.product?.handle ?? null,
                convexImageUrl: product.imageUrl ?? null,
                convexImageHost: host(product.imageUrl),
            });
            continue;
        }

        const reason = patchReason(product.imageUrl, shopifyImageUrl);
        if (!reason) continue;

        patches.push({
            websiteSku: product.websiteSku,
            graceSku: product.graceSku,
            family: product.family,
            productHandle: shopifyVariant.product?.handle ?? null,
            reason,
            currentImageUrl: product.imageUrl ?? null,
            currentImageHost: host(product.imageUrl),
            shopifyImageUrl,
        });
    }

    const selectedPatches = LIMIT > 0 ? patches.slice(0, LIMIT) : patches;
    const applied = [];
    const failed = [];

    if (APPLY) {
        for (const patch of selectedPatches) {
            try {
                const result = await convex.mutation(api.products.setVariantImages, {
                    websiteSku: patch.websiteSku,
                    imageUrl: patch.shopifyImageUrl,
                    writeToken: WRITE_TOKEN,
                });
                applied.push({ ...patch, result });
            } catch (error) {
                failed.push({ ...patch, error: String(error?.message ?? error) });
            }
        }
    }

    const report = {
        generatedAt: new Date().toISOString(),
        mode: APPLY ? "apply" : "dry-run",
        family: FAMILY ?? "ALL",
        convexUrl: CONVEX_URL,
        shopifyDomain: SHOPIFY_DOMAIN,
        totals: {
            convexProducts: convexProducts.length,
            shopifyVariants: shopifyVariants.length,
            patchesReady: patches.length,
            patchesSelected: selectedPatches.length,
            applied: applied.length,
            failed: failed.length,
            skippedMissingShopifyImage: skippedMissingShopifyImage.length,
            skippedUnmatchedShopifySku: skippedUnmatchedShopifySku.length,
            skippedDuplicateShopifySku: skippedDuplicateShopifySku.length,
        },
        samples: {
            patchesReady: patches.slice(0, 25),
            skippedMissingShopifyImage: skippedMissingShopifyImage.slice(0, 25),
            skippedUnmatchedShopifySku: skippedUnmatchedShopifySku.slice(0, 25),
            skippedDuplicateShopifySku: skippedDuplicateShopifySku.slice(0, 25),
            failed,
        },
    };

    if (JSON_MODE) {
        console.log(JSON.stringify(report, null, 2));
        return;
    }

    console.log("Convex ← Shopify Variant Media Backfill");
    console.log("──────────────────────────────────────");
    console.log(`Mode: ${report.mode}`);
    console.log(`Family: ${report.family}`);
    console.log(`Convex URL: ${report.convexUrl}`);
    console.log(`Shopify: ${report.shopifyDomain}`);
    for (const [key, value] of Object.entries(report.totals)) {
        console.log(`${key}: ${value}`);
    }
    if (!APPLY) console.log("\nDry-run only. Re-run with --apply to patch Convex.");
    if (report.samples.patchesReady.length) {
        console.log("\nPatch sample:");
        for (const row of report.samples.patchesReady.slice(0, 12)) {
            console.log(`  ${row.websiteSku} / ${row.graceSku}: ${row.reason} (${row.currentImageHost ?? "missing"} → cdn.shopify.com)`);
        }
    }
    if (report.samples.skippedMissingShopifyImage.length) {
        console.log("\nMissing Shopify variant-image sample:");
        for (const row of report.samples.skippedMissingShopifyImage.slice(0, 12)) {
            console.log(`  ${row.websiteSku} / ${row.graceSku}: current=${row.convexImageHost ?? "missing"} handle=${row.productHandle ?? "unknown"}`);
        }
    }
    if (report.samples.skippedDuplicateShopifySku.length) {
        console.log("\nDuplicate Shopify SKU sample:");
        for (const row of report.samples.skippedDuplicateShopifySku.slice(0, 12)) {
            console.log(`  ${row.websiteSku} / ${row.graceSku}: ${row.shopifyVariantIds.length} Shopify variants share this SKU`);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
