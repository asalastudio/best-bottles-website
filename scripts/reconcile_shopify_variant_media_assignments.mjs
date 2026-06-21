#!/usr/bin/env node
/**
 * Attach existing Shopify product media to Shopify variants, then optionally
 * sync the assigned Shopify CDN URL back into Convex.
 *
 * This is for rows where the product already has media, but the variant image
 * is empty. It does not upload or generate new media.
 *
 * Dry-run by default.
 *
 * Usage:
 *   node scripts/reconcile_shopify_variant_media_assignments.mjs --slug atomizer-5ml
 *   node scripts/reconcile_shopify_variant_media_assignments.mjs --slug atomizer-5ml --apply
 *   node scripts/reconcile_shopify_variant_media_assignments.mjs --family Atomizer --limit 25 --json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const API_VERSION = "2025-01";
const DEFAULT_MANIFEST = resolve(
    ROOT,
    "data/audits/stage-in-sight-image-sync-2026-06-15/coordinator/missing_shopify_variant_images.csv",
);
const DEFAULT_OUT_DIR = resolve(
    ROOT,
    "data/audits/stage-in-sight-image-sync-2026-06-15/cleanup",
);

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

function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];
        if (inQuotes) {
            if (char === '"' && next === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                field += char;
            }
        } else if (char === '"') {
            inQuotes = true;
        } else if (char === ",") {
            row.push(field);
            field = "";
        } else if (char === "\n" || char === "\r") {
            if (char === "\r" && next === "\n") i++;
            row.push(field);
            field = "";
            if (row.length > 1 || row[0] !== "") rows.push(row);
            row = [];
        } else {
            field += char;
        }
    }

    if (field !== "" || row.length) {
        row.push(field);
        rows.push(row);
    }

    const [header, ...body] = rows;
    if (!header) return [];
    return body.map((cells) => Object.fromEntries(header.map((key, idx) => [key, cells[idx] ?? ""])));
}

function host(value) {
    try {
        return new URL(value).hostname;
    } catch {
        return "";
    }
}

function isShopifyCdn(value) {
    return host(value) === "cdn.shopify.com";
}

function normalizeUrl(value) {
    if (!value) return "";
    try {
        const url = new URL(value);
        url.searchParams.delete("v");
        return url.toString();
    } catch {
        return String(value);
    }
}

function imageFileStem(value) {
    if (!value) return "";
    try {
        const url = new URL(value);
        const file = decodeURIComponent(url.pathname.split("/").pop() ?? "");
        return file.replace(/\.(png|jpe?g|webp|gif)$/i, "");
    } catch {
        const file = String(value).split("?")[0].split("/").pop() ?? "";
        return file.replace(/\.(png|jpe?g|webp|gif)$/i, "");
    }
}

function canonicalImageKey(value) {
    return imageFileStem(value)
        .toLowerCase()
        .replace(/[_-][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "");
}

function matchProductMedia(productMedia, targetUrl) {
    const directMatches = productMedia.filter(
        (media) => normalizeUrl(media.url) === normalizeUrl(targetUrl),
    );
    if (directMatches.length === 1) {
        return { status: "matched", strategy: "exact_url", media: directMatches[0] };
    }
    if (directMatches.length > 1) {
        return { status: "ambiguous", strategy: "exact_url", matches: directMatches };
    }

    const targetKey = canonicalImageKey(targetUrl);
    if (!targetKey) return { status: "missing", strategy: "canonical_filename", matches: [] };

    const canonicalMatches = productMedia.filter((media) => canonicalImageKey(media.url) === targetKey);
    if (canonicalMatches.length === 1) {
        return { status: "matched", strategy: "canonical_filename", media: canonicalMatches[0] };
    }
    if (canonicalMatches.length > 1) {
        return { status: "ambiguous", strategy: "canonical_filename", matches: canonicalMatches };
    }
    return { status: "missing", strategy: "canonical_filename", matches: [] };
}

loadEnv();

const MANIFEST = argValue("--manifest") ?? DEFAULT_MANIFEST;
const OUT_DIR = argValue("--out-dir") ?? DEFAULT_OUT_DIR;
const FAMILY = argValue("--family");
const SLUG = argValue("--slug");
const SKU = argValue("--sku");
const LIMIT = Number(argValue("--limit") ?? "0");
const APPLY = process.argv.includes("--apply");
const REPLACE = process.argv.includes("--replace");
const JSON_MODE = process.argv.includes("--json");
const PATCH_CONVEX = !process.argv.includes("--no-convex");

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const SHOPIFY_DOMAIN = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const WRITE_TOKEN = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;

const missing = [
    !CONVEX_URL ? "NEXT_PUBLIC_CONVEX_URL" : "",
    !SHOPIFY_DOMAIN ? "NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN" : "",
    !SHOPIFY_TOKEN ? "SHOPIFY_ADMIN_TOKEN" : "",
    APPLY && PATCH_CONVEX && !WRITE_TOKEN ? "BEST_BOTTLES_CONVEX_WRITE_TOKEN" : "",
].filter(Boolean);

if (missing.length) {
    console.error(`Missing required env: ${missing.join(", ")}`);
    process.exit(1);
}

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function shopifyGraphQL(query, variables, attempt = 0) {
    const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": SHOPIFY_TOKEN,
        },
        body: JSON.stringify({ query, variables }),
    });
    const text = await res.text();
    if (res.status === 429 && attempt < 5) {
        await sleep(1500 * (attempt + 1));
        return shopifyGraphQL(query, variables, attempt + 1);
    }
    if (!res.ok) throw new Error(`Shopify HTTP ${res.status}: ${text.slice(0, 500)}`);
    const json = JSON.parse(text);
    if (json.errors?.length) {
        const throttled = json.errors.some((error) => error.extensions?.code === "THROTTLED");
        if (throttled && attempt < 5) {
            await sleep(2000 * (attempt + 1));
            return shopifyGraphQL(query, variables, attempt + 1);
        }
        throw new Error(`Shopify GraphQL: ${json.errors.map((error) => error.message).join("; ")}`);
    }
    return json.data;
}

async function fetchVariantsById(ids) {
    const variants = [];
    const query = `
      query VariantMediaNodes($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on ProductVariant {
            id
            sku
            title
            image { id url altText }
            product {
              id
              title
              handle
              media(first: 250) {
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
      }
    `;
    for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const data = await shopifyGraphQL(query, { ids: chunk });
        variants.push(...data.nodes.filter(Boolean));
    }
    return variants;
}

async function appendVariantMedia(productId, variantMedia) {
    const data = await shopifyGraphQL(
        `mutation AppendVariantMedia($productId: ID!, $variantMedia: [ProductVariantAppendMediaInput!]!) {
          productVariantAppendMedia(productId: $productId, variantMedia: $variantMedia) {
            productVariants { id sku image { url } }
            userErrors { field message }
          }
        }`,
        { productId, variantMedia },
    );
    const payload = data.productVariantAppendMedia;
    if (payload.userErrors?.length) {
        throw new Error(payload.userErrors.map((error) => error.message).join("; "));
    }
    return payload.productVariants;
}

function selectRows() {
    const rows = parseCsv(readFileSync(MANIFEST, "utf8")).filter(
        (row) => row.issue === "product_media_not_assigned_to_variant",
    );
    const filtered = rows.filter((row) => {
        if (FAMILY && row.family !== FAMILY) return false;
        if (SLUG && row.product_group_slug !== SLUG) return false;
        if (SKU) {
            const wanted = SKU.toUpperCase();
            if (row.sku.toUpperCase() !== wanted && row.website_sku.toUpperCase() !== wanted) return false;
        }
        return true;
    });
    return LIMIT > 0 ? filtered.slice(0, LIMIT) : filtered;
}

async function main() {
    const rows = selectRows();
    const variants = await fetchVariantsById(Array.from(new Set(rows.map((row) => row.shopify_variant_id))));
    const variantById = new Map(variants.map((variant) => [variant.id, variant]));

    const plan = [];
    const skippedAlreadyHasImage = [];
    const skippedMissingVariant = [];
    const skippedTargetNotShopify = [];
    const skippedNoMediaMatch = [];
    const skippedAmbiguousMediaMatch = [];

    for (const row of rows) {
        const variant = variantById.get(row.shopify_variant_id);
        if (!variant) {
            skippedMissingVariant.push(row);
            continue;
        }
        if (variant.image?.url && !REPLACE) {
            skippedAlreadyHasImage.push({ ...row, shopifyVariantImageUrl: variant.image.url });
            continue;
        }

        const targetUrl = row.convex_image_url;
        if (!isShopifyCdn(targetUrl)) {
            skippedTargetNotShopify.push({ ...row, targetUrl, targetHost: host(targetUrl) });
            continue;
        }

        const productMedia = (variant.product?.media?.edges ?? [])
            .map((edge) => edge.node)
            .filter((node) => node?.__typename === "MediaImage" && node.image?.url)
            .map((node) => ({ id: node.id, url: node.image.url, alt: node.alt ?? "" }));
        const match = matchProductMedia(productMedia, targetUrl);
        if (match.status === "missing") {
            skippedNoMediaMatch.push({
                ...row,
                targetUrl,
                productMediaCount: productMedia.length,
                productMediaSample: productMedia.slice(0, 5).map((media) => media.url),
            });
            continue;
        }
        if (match.status === "ambiguous") {
            skippedAmbiguousMediaMatch.push({
                ...row,
                targetUrl,
                matchStrategy: match.strategy,
                matches: match.matches.map((media) => media.url),
            });
            continue;
        }

        plan.push({
            family: row.family,
            productGroupSlug: row.product_group_slug,
            graceSku: row.sku,
            websiteSku: row.website_sku,
            variantId: variant.id,
            productId: variant.product.id,
            productHandle: variant.product.handle,
            mediaId: match.media.id,
            mediaUrl: match.media.url,
            currentConvexImageUrl: row.convex_image_url,
            matchStrategy: match.strategy,
        });
    }

    const byProduct = new Map();
    for (const item of plan) {
        const items = byProduct.get(item.productId) ?? [];
        items.push(item);
        byProduct.set(item.productId, items);
    }

    const assigned = [];
    const convexPatched = [];
    const failed = [];
    const convex = APPLY && PATCH_CONVEX ? new ConvexHttpClient(CONVEX_URL) : null;

    if (APPLY) {
        for (const [productId, items] of byProduct) {
            try {
                const productVariants = await appendVariantMedia(
                    productId,
                    items.map((item) => ({ variantId: item.variantId, mediaIds: [item.mediaId] })),
                );
                const returnedByVariantId = new Map(productVariants.map((variant) => [variant.id, variant]));
                for (const item of items) {
                    const returnedVariant = returnedByVariantId.get(item.variantId);
                    const assignedUrl = returnedVariant?.image?.url ?? item.mediaUrl;
                    assigned.push({ ...item, assignedUrl });
                    if (convex) {
                        try {
                            const result = await convex.mutation(api.products.setVariantImages, {
                                // Some component rows share websiteSku across different Grace SKUs.
                                // Patch by Grace SKU to avoid cross-row image ping-pong.
                                websiteSku: item.graceSku,
                                imageUrl: assignedUrl,
                                writeToken: WRITE_TOKEN,
                            });
                            if (result?.success === false) {
                                failed.push({
                                    stage: "convex_patch",
                                    graceSku: item.graceSku,
                                    websiteSku: item.websiteSku,
                                    error: result.error ?? "mutation_returned_success_false",
                                    result,
                                });
                                continue;
                            }
                            convexPatched.push({ ...item, assignedUrl, result });
                        } catch (error) {
                            failed.push({
                                stage: "convex_patch",
                                graceSku: item.graceSku,
                                websiteSku: item.websiteSku,
                                error: String(error?.message ?? error),
                            });
                        }
                    }
                }
            } catch (error) {
                failed.push({
                    stage: "shopify_variant_media_assignment",
                    productId,
                    skus: items.map((item) => item.graceSku),
                    error: String(error?.message ?? error),
                });
            }
            await sleep(300);
        }
    }

    mkdirSync(OUT_DIR, { recursive: true });
    const report = {
        generatedAt: new Date().toISOString(),
        mode: APPLY ? "apply" : "dry-run",
        manifest: MANIFEST,
        family: FAMILY ?? "ALL",
        productGroupSlug: SLUG ?? "ALL",
        sku: SKU ?? "ALL",
        convexUrl: CONVEX_URL,
        shopifyDomain: SHOPIFY_DOMAIN,
        patchConvex: PATCH_CONVEX,
        totals: {
            rowsSelected: rows.length,
            variantsFetched: variants.length,
            planReady: plan.length,
            productsTouched: byProduct.size,
            assigned: assigned.length,
            convexPatched: convexPatched.length,
            failed: failed.length,
            skippedAlreadyHasImage: skippedAlreadyHasImage.length,
            skippedMissingVariant: skippedMissingVariant.length,
            skippedTargetNotShopify: skippedTargetNotShopify.length,
            skippedNoMediaMatch: skippedNoMediaMatch.length,
            skippedAmbiguousMediaMatch: skippedAmbiguousMediaMatch.length,
        },
        samples: {
            plan: plan.slice(0, 25),
            assigned: assigned.slice(0, 25),
            convexPatched: convexPatched.slice(0, 25),
            failed,
            skippedAlreadyHasImage: skippedAlreadyHasImage.slice(0, 25),
            skippedMissingVariant: skippedMissingVariant.slice(0, 25),
            skippedTargetNotShopify: skippedTargetNotShopify.slice(0, 25),
            skippedNoMediaMatch: skippedNoMediaMatch.slice(0, 25),
            skippedAmbiguousMediaMatch: skippedAmbiguousMediaMatch.slice(0, 25),
        },
    };

    const stamp = report.generatedAt.replace(/[:.]/g, "-");
    const reportPath = resolve(OUT_DIR, `shopify_variant_assignment_${report.mode}_${stamp}.json`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    if (JSON_MODE) {
        console.log(JSON.stringify({ ...report, reportPath }, null, 2));
        return;
    }

    console.log("Shopify Variant Media Assignment Reconciliation");
    console.log("──────────────────────────────────────────────");
    console.log(`Mode: ${report.mode}`);
    console.log(`Family: ${report.family}`);
    console.log(`Product group: ${report.productGroupSlug}`);
    console.log(`SKU: ${report.sku}`);
    console.log(`Shopify: ${SHOPIFY_DOMAIN}`);
    console.log(`Convex patch: ${PATCH_CONVEX ? "enabled" : "disabled"}`);
    for (const [key, value] of Object.entries(report.totals)) {
        console.log(`${key}: ${value}`);
    }
    console.log(`Report: ${reportPath}`);
    if (!APPLY) console.log("\nDry-run only. Re-run with --apply to attach media and patch Convex.");
    if (failed.length) {
        console.log("\nFailures:");
        for (const failure of failed.slice(0, 10)) {
            console.log(`  [${failure.stage}] ${failure.skus?.join(",") ?? failure.graceSku}: ${failure.error}`);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
