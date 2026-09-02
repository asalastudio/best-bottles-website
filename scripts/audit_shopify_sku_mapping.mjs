#!/usr/bin/env node
/**
 * Read-only Shopify ↔ Convex SKU mapping audit.
 *
 * Compares purchasable Convex products against Shopify Admin variants and
 * reports checkout-readiness gaps. This script does not write to Shopify,
 * Convex, Sanity, or local product data.
 *
 * Usage:
 *   node scripts/audit_shopify_sku_mapping.mjs
 *   node scripts/audit_shopify_sku_mapping.mjs --json
 *   node scripts/audit_shopify_sku_mapping.mjs --limit 200
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

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
        // .env.local is optional; CI can pass env directly.
    }
}

function argValue(name) {
    const index = process.argv.indexOf(name);
    if (index < 0) return undefined;
    const value = process.argv[index + 1];
    return value && !value.startsWith("--") ? value : undefined;
}

loadEnv();

const JSON_MODE = process.argv.includes("--json");
const LIMIT = Number(argValue("--limit")) || undefined;
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const SHOPIFY_DOMAIN = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = "2025-01";

const missing = [
    !CONVEX_URL ? "NEXT_PUBLIC_CONVEX_URL" : "",
    !SHOPIFY_DOMAIN ? "NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN" : "",
    !SHOPIFY_TOKEN ? "SHOPIFY_ADMIN_TOKEN" : "",
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
        throw new Error(`Shopify GraphQL: ${json.errors.map((e) => e.message).join("; ")}`);
    }
    return json.data;
}

async function fetchConvexProducts() {
    const convex = new ConvexHttpClient(CONVEX_URL);
    const products = [];
    let cursor = null;

    while (true) {
        const result = await convex.action(api.products.getProductExportPage, {
            cursor,
            numItems: 250,
        });
        for (const product of result.page) {
            products.push(product);
            if (LIMIT && products.length >= LIMIT) return products;
        }
        if (result.isDone) return products;
        cursor = result.continueCursor;
    }
}

async function fetchShopifyVariants() {
    const variants = [];
    let cursor = null;
    const query = `
      query ProductVariants($first: Int!, $after: String) {
        productVariants(first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              sku
              title
              price
              availableForSale
              product { id title handle }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;

    while (true) {
        const data = await shopifyGraphQL(query, { first: 250, after: cursor });
        for (const edge of data.productVariants.edges) {
            variants.push(edge.node);
        }
        if (!data.productVariants.pageInfo.hasNextPage) return variants;
        cursor = data.productVariants.pageInfo.endCursor;
    }
}

function isPurchasable(product) {
    return Boolean(product?.graceSku) && typeof product.webPrice1pc === "number" && product.webPrice1pc > 0;
}

function isCanonicalGraceSku(value) {
    return /^[A-Z]{2,3}(?:-[A-Z0-9.]+){2,}$/.test(String(value ?? "").trim());
}

function sample(rows, count = 25) {
    return rows.slice(0, count);
}

async function main() {
    const [convexProducts, shopifyVariants] = await Promise.all([
        fetchConvexProducts(),
        fetchShopifyVariants(),
    ]);

    const purchasableProducts = convexProducts.filter(isPurchasable);
    const shopifyBySku = new Map();
    for (const variant of shopifyVariants) {
        const sku = String(variant.sku ?? "").trim();
        if (!sku) continue;
        const list = shopifyBySku.get(sku) ?? [];
        list.push(variant);
        shopifyBySku.set(sku, list);
    }

    const matched = [];
    const unmatched = [];
    const missingStoredShopifyVariantId = [];
    const mismatchedStoredShopifyVariantId = [];
    const duplicateShopifySkuMatches = [];
    const orderableButNotCheckoutReady = [];
    const nonCanonicalGraceSku = [];

    for (const product of purchasableProducts) {
        const hasCanonicalGraceSku = isCanonicalGraceSku(product.graceSku);
        const matches = shopifyBySku.get(product.graceSku) ?? [];
        const storedId = product.shopifyVariantId ?? null;
        const isOrderable = product.stockStatus === "In Stock" || product.stockStatus == null;

        if (!hasCanonicalGraceSku) {
            nonCanonicalGraceSku.push(product);
            if (isOrderable) orderableButNotCheckoutReady.push(product);
            continue;
        }

        if (matches.length === 0) {
            unmatched.push(product);
        } else {
            matched.push({ product, shopifyVariant: matches[0] });
        }

        if (!storedId) {
            missingStoredShopifyVariantId.push(product);
        } else if (matches.length > 0 && !matches.some((variant) => variant.id === storedId)) {
            mismatchedStoredShopifyVariantId.push({ product, shopifyIds: matches.map((v) => v.id) });
        }

        if (matches.length > 1) {
            duplicateShopifySkuMatches.push({ product, matchCount: matches.length, shopifyIds: matches.map((v) => v.id) });
        }

        if (isOrderable && (!storedId || matches.length === 0 || matches.length > 1)) {
            orderableButNotCheckoutReady.push(product);
        }
    }

    const report = {
        generatedAt: new Date().toISOString(),
        mode: "read-only",
        shopifyDomain: SHOPIFY_DOMAIN,
        totals: {
            convexProducts: convexProducts.length,
            purchasableConvexProducts: purchasableProducts.length,
            shopifyVariants: shopifyVariants.length,
            uniqueShopifySkus: shopifyBySku.size,
            matchedSkus: matched.length,
            unmatchedSkus: unmatched.length,
            duplicateShopifySkuMatches: duplicateShopifySkuMatches.length,
            productsWithShopifyVariantIdMissing: missingStoredShopifyVariantId.length,
            productsWithShopifyVariantIdMismatch: mismatchedStoredShopifyVariantId.length,
            productsMarkedOrderableButNotCheckoutReady: orderableButNotCheckoutReady.length,
            productsWithNonCanonicalGraceSku: nonCanonicalGraceSku.length,
        },
        samples: {
            unmatchedSkus: sample(unmatched).map((p) => ({ graceSku: p.graceSku, websiteSku: p.websiteSku, itemName: p.itemName })),
            nonCanonicalGraceSku: sample(nonCanonicalGraceSku).map((p) => ({
                graceSku: p.graceSku,
                websiteSku: p.websiteSku,
                itemName: p.itemName,
                stockStatus: p.stockStatus,
            })),
            duplicateShopifySkuMatches: sample(duplicateShopifySkuMatches).map((row) => ({
                graceSku: row.product.graceSku,
                websiteSku: row.product.websiteSku,
                matchCount: row.matchCount,
                shopifyIds: row.shopifyIds,
            })),
            productsWithShopifyVariantIdMissing: sample(missingStoredShopifyVariantId).map((p) => ({ graceSku: p.graceSku, websiteSku: p.websiteSku, itemName: p.itemName })),
            productsWithShopifyVariantIdMismatch: sample(mismatchedStoredShopifyVariantId).map((row) => ({
                graceSku: row.product.graceSku,
                storedShopifyVariantId: row.product.shopifyVariantId,
                matchingShopifyIds: row.shopifyIds,
            })),
            productsMarkedOrderableButNotCheckoutReady: sample(orderableButNotCheckoutReady).map((p) => ({
                graceSku: p.graceSku,
                websiteSku: p.websiteSku,
                stockStatus: p.stockStatus,
                itemName: p.itemName,
            })),
        },
    };

    if (JSON_MODE) {
        console.log(JSON.stringify(report, null, 2));
        return;
    }

    console.log("\nShopify SKU Mapping Audit (read-only)");
    console.log("====================================");
    console.log(`Generated: ${report.generatedAt}`);
    console.log(`Store: ${SHOPIFY_DOMAIN}`);
    console.log("\nTotals");
    for (const [key, value] of Object.entries(report.totals)) {
        console.log(`- ${key}: ${value}`);
    }
    console.log("\nSample unmatched SKUs");
    console.table(report.samples.unmatchedSkus);
    console.log("\nSample orderable but not checkout-ready");
    console.table(report.samples.productsMarkedOrderableButNotCheckoutReady);
    console.log("\nSample duplicate Shopify SKU matches");
    console.table(report.samples.duplicateShopifySkuMatches);
    console.log("\nNo writes were performed.");
}

main().catch((err) => {
    console.error("Audit failed:", err.message || err);
    process.exit(1);
});
