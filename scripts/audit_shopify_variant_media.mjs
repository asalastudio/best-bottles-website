#!/usr/bin/env node
/**
 * Read-only Shopify variant media ↔ Convex cached image audit.
 *
 * Shopify product media can exist without being assigned to a specific variant.
 * This audit focuses on the SKU-level image truth that Best Bottles needs for
 * PDP variant selection and catalog thumbnails.
 *
 * Usage:
 *   node scripts/audit_shopify_variant_media.mjs
 *   node scripts/audit_shopify_variant_media.mjs --family Empire
 *   node scripts/audit_shopify_variant_media.mjs --json > /tmp/variant-media.json
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

loadEnv();

const JSON_MODE = process.argv.includes("--json");
const FULL_REPORT = process.argv.includes("--full-report");
const FAMILY = argValue("--family");
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
        throw new Error(`Shopify GraphQL: ${json.errors.map((error) => error.message).join("; ")}`);
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
              product {
                id
                title
                handle
                media(first: 20) {
                  edges {
                    node {
                      __typename
                      ... on MediaImage {
                        id
                        alt
                        image { url }
                      }
                    }
                  }
                }
              }
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

function sample(rows, count = 25) {
    return rows.slice(0, count);
}

async function main() {
    const [convexProducts, shopifyVariants] = await Promise.all([
        fetchConvexProducts(),
        fetchShopifyVariants(),
    ]);

    const convexBySku = new Map(convexProducts.map((product) => [product.graceSku, product]));
    const variantBySku = new Map();
    for (const variant of shopifyVariants) {
        if (variant.sku) variantBySku.set(variant.sku, variant);
    }

    const matched = [];
    const missingShopifyVariantImage = [];
    const shopifyImageNotCachedInConvex = [];
    const convexDiffersFromShopify = [];
    const convexNonShopifyWhenShopifyExists = [];

    for (const product of convexProducts) {
        if (!product?.graceSku) continue;
        const shopifyVariant = variantBySku.get(product.graceSku);
        if (!shopifyVariant) continue;

        matched.push(product);
        const shopifyImageUrl = shopifyVariant.image?.url ?? null;
        const convexImageUrl = product.imageUrl ?? null;
        const productMediaUrls = (shopifyVariant.product?.media?.edges ?? [])
            .map((edge) => edge.node?.image?.url)
            .filter(Boolean);

        if (!shopifyImageUrl) {
            missingShopifyVariantImage.push({
                graceSku: product.graceSku,
                websiteSku: product.websiteSku,
                family: product.family,
                itemName: product.itemName,
                productHandle: shopifyVariant.product?.handle ?? null,
                productMediaCount: productMediaUrls.length,
                productMediaSample: productMediaUrls.slice(0, 5),
                convexImageUrl,
            });
            continue;
        }

        if (!convexImageUrl) {
            shopifyImageNotCachedInConvex.push({
                graceSku: product.graceSku,
                websiteSku: product.websiteSku,
                family: product.family,
                shopifyImageUrl,
            });
            continue;
        }

        if (normalizeUrl(convexImageUrl) !== normalizeUrl(shopifyImageUrl)) {
            convexDiffersFromShopify.push({
                graceSku: product.graceSku,
                websiteSku: product.websiteSku,
                family: product.family,
                productHandle: shopifyVariant.product?.handle ?? null,
                convexImageUrl,
                shopifyImageUrl,
            });
        }

        if (!isShopifyCdn(convexImageUrl)) {
            convexNonShopifyWhenShopifyExists.push({
                graceSku: product.graceSku,
                websiteSku: product.websiteSku,
                family: product.family,
                convexImageUrl,
                shopifyImageUrl,
            });
        }
    }

    const report = {
        generatedAt: new Date().toISOString(),
        mode: "read-only",
        family: FAMILY ?? "ALL",
        shopifyDomain: SHOPIFY_DOMAIN,
        totals: {
            convexProducts: convexProducts.length,
            shopifyVariants: shopifyVariants.length,
            matchedSkuVariants: matched.length,
            missingShopifyVariantImage: missingShopifyVariantImage.length,
            shopifyImageNotCachedInConvex: shopifyImageNotCachedInConvex.length,
            convexDiffersFromShopify: convexDiffersFromShopify.length,
            convexNonShopifyWhenShopifyExists: convexNonShopifyWhenShopifyExists.length,
        },
        samples: {
            missingShopifyVariantImage: sample(missingShopifyVariantImage),
            shopifyImageNotCachedInConvex: sample(shopifyImageNotCachedInConvex),
            convexDiffersFromShopify: sample(convexDiffersFromShopify),
            convexNonShopifyWhenShopifyExists: sample(convexNonShopifyWhenShopifyExists),
        },
    };

    if (FULL_REPORT) {
        report.full = {
            missingShopifyVariantImage,
            shopifyImageNotCachedInConvex,
            convexDiffersFromShopify,
            convexNonShopifyWhenShopifyExists,
        };
    }

    if (JSON_MODE) {
        console.log(JSON.stringify(report, null, 2));
        return;
    }

    console.log("Shopify Variant Media Audit");
    console.log("───────────────────────────");
    console.log(`Family: ${report.family}`);
    for (const [key, value] of Object.entries(report.totals)) {
        console.log(`${key}: ${value}`);
    }
    console.log("\nMissing Shopify variant-image sample:");
    for (const row of report.samples.missingShopifyVariantImage.slice(0, 10)) {
        console.log(`  ${row.graceSku} (${row.productHandle}) productMedia=${row.productMediaCount}`);
    }
    console.log("\nConvex differs from Shopify sample:");
    for (const row of report.samples.convexDiffersFromShopify.slice(0, 10)) {
        console.log(`  ${row.graceSku} (${row.productHandle})`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
