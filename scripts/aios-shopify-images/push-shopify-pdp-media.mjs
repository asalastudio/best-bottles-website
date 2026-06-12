#!/usr/bin/env node
/**
 * Push generated PDP media (Madison/GPT Image 2 renders) to Shopify and
 * surface them in the UI.
 *
 * Per manifest row this script:
 *   1. uploads the evidence image to the Shopify product (productCreateMedia,
 *      Shopify fetches the public URL itself),
 *   2. waits for media processing to finish,
 *   3. attaches the media to the variant matched by graceSku === variant.sku
 *      (productVariantAppendMedia),
 *   4. patches Convex `imageUrl` with the resulting cdn.shopify.com URL so the
 *      catalog/PDP Shopify-CDN gate passes.
 *
 * Dry-run by default. Idempotent: variants that already carry a Shopify
 * variant image are skipped unless --replace is passed.
 *
 * Usage:
 *   node scripts/aios-shopify-images/push-shopify-pdp-media.mjs
 *   node scripts/aios-shopify-images/push-shopify-pdp-media.mjs --family Cylinder --limit 5 --apply
 *   node scripts/aios-shopify-images/push-shopify-pdp-media.mjs --manifest path/to.csv --apply
 *   node scripts/aios-shopify-images/push-shopify-pdp-media.mjs --json > report.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const API_VERSION = "2025-01";
const DEFAULT_MANIFEST = resolve(
    ROOT,
    "data/audits/launch-image-worklist-2026-06-12/2_generated_but_not_in_shopify.csv",
);
// Only these hosts are trusted generated-image sources. Legacy
// www.bestbottles.com gifs are deliberately excluded (blocked in the UI too).
const ALLOWED_EVIDENCE_HOSTS = new Set(["likkskifwsrvszxdvufw.supabase.co"]);

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

function host(value) {
    try {
        return new URL(value).hostname;
    } catch {
        return null;
    }
}

/** Minimal CSV parser for the audit worklist (handles quoted fields). */
function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
            else if (c === '"') inQuotes = false;
            else field += c;
        } else if (c === '"') inQuotes = true;
        else if (c === ",") { row.push(field); field = ""; }
        else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n") i++;
            row.push(field); field = "";
            if (row.length > 1 || row[0] !== "") rows.push(row);
            row = [];
        } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    const [header, ...body] = rows;
    return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

loadEnv();

const FAMILY = argValue("--family");
const LIMIT = Number(argValue("--limit") ?? "0");
const MANIFEST = argValue("--manifest") ?? DEFAULT_MANIFEST;
const APPLY = process.argv.includes("--apply");
const REPLACE = process.argv.includes("--replace");
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
        const throttled = json.errors.some((e) => e.extensions?.code === "THROTTLED");
        if (throttled && attempt < 5) {
            await sleep(2000 * (attempt + 1));
            return shopifyGraphQL(query, variables, attempt + 1);
        }
        throw new Error(`Shopify GraphQL: ${json.errors.map((e) => e.message).join("; ")}`);
    }
    return json.data;
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
              image { id url }
              product { id title handle }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
    while (true) {
        const data = await shopifyGraphQL(query, { first: 250, after: cursor });
        for (const edge of data.productVariants.edges) variants.push(edge.node);
        if (!data.productVariants.pageInfo.hasNextPage) return variants;
        cursor = data.productVariants.pageInfo.endCursor;
    }
}

async function createProductMedia(productId, mediaInputs) {
    const data = await shopifyGraphQL(
        `mutation CreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
          productCreateMedia(productId: $productId, media: $media) {
            media { id status alt }
            mediaUserErrors { field message code }
          }
        }`,
        { productId, media: mediaInputs },
    );
    const payload = data.productCreateMedia;
    if (payload.mediaUserErrors?.length) {
        throw new Error(payload.mediaUserErrors.map((e) => `${e.code ?? ""} ${e.message}`).join("; "));
    }
    return payload.media;
}

async function waitForMediaReady(mediaIds, { timeoutMs = 120000 } = {}) {
    const started = Date.now();
    const byId = new Map();
    let pending = [...mediaIds];
    while (pending.length) {
        if (Date.now() - started > timeoutMs) {
            throw new Error(`Timed out waiting for media processing: ${pending.join(", ")}`);
        }
        await sleep(2000);
        const data = await shopifyGraphQL(
            `query MediaStatus($ids: [ID!]!) {
              nodes(ids: $ids) {
                ... on MediaImage { id status image { url } }
              }
            }`,
            { ids: pending },
        );
        pending = [];
        for (const node of data.nodes) {
            if (!node) continue;
            if (node.status === "READY" && node.image?.url) byId.set(node.id, node.image.url);
            else if (node.status === "FAILED") throw new Error(`Media processing FAILED: ${node.id}`);
            else pending.push(node.id);
        }
    }
    return byId;
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
        throw new Error(payload.userErrors.map((e) => e.message).join("; "));
    }
    return payload.productVariants;
}

async function main() {
    const manifestRows = parseCsv(readFileSync(MANIFEST, "utf8"));
    const convex = new ConvexHttpClient(CONVEX_URL);

    // Filter manifest to trusted generated evidence.
    const skippedUntrustedSource = [];
    let rows = manifestRows.filter((r) => {
        if (FAMILY && r.family !== FAMILY) return false;
        const h = host(r.coverageEvidenceUrl);
        if (!h || !ALLOWED_EVIDENCE_HOSTS.has(h)) {
            skippedUntrustedSource.push({ graceSku: r.graceSku, family: r.family, evidenceHost: h });
            return false;
        }
        return true;
    });

    const shopifyVariants = await fetchShopifyVariants();
    const variantBySku = new Map();
    const duplicateSkus = new Set();
    for (const v of shopifyVariants) {
        if (!v.sku) continue;
        if (variantBySku.has(v.sku)) { duplicateSkus.add(v.sku); continue; }
        variantBySku.set(v.sku, v);
    }

    const skippedUnmatchedSku = [];
    const skippedDuplicateSku = [];
    const skippedAlreadyHasImage = [];
    const plan = [];
    for (const r of rows) {
        if (duplicateSkus.has(r.graceSku)) { skippedDuplicateSku.push(r.graceSku); continue; }
        const variant = variantBySku.get(r.graceSku);
        if (!variant) { skippedUnmatchedSku.push(r.graceSku); continue; }
        if (variant.image?.url && !REPLACE) {
            skippedAlreadyHasImage.push({ graceSku: r.graceSku, url: variant.image.url });
            continue;
        }
        plan.push({
            graceSku: r.graceSku,
            websiteSku: r.websiteSku,
            family: r.family,
            alt: (r.itemName ?? "").slice(0, 250) || r.graceSku,
            evidenceUrl: r.coverageEvidenceUrl,
            variantId: variant.id,
            productId: variant.product.id,
            productHandle: variant.product.handle,
        });
    }

    const selected = LIMIT > 0 ? plan.slice(0, LIMIT) : plan;

    // Group by product so each product gets one create + one append call.
    const byProduct = new Map();
    for (const item of selected) {
        const group = byProduct.get(item.productId) ?? [];
        group.push(item);
        byProduct.set(item.productId, group);
    }

    const uploaded = [];
    const convexPatched = [];
    const failed = [];

    if (APPLY) {
        let done = 0;
        for (const [productId, items] of byProduct) {
            try {
                const media = await createProductMedia(
                    productId,
                    items.map((i) => ({
                        originalSource: i.evidenceUrl,
                        mediaContentType: "IMAGE",
                        alt: i.alt,
                    })),
                );
                if (media.length !== items.length) {
                    throw new Error(`media count mismatch: sent ${items.length}, got ${media.length}`);
                }
                const urlByMediaId = await waitForMediaReady(media.map((m) => m.id));
                await appendVariantMedia(
                    productId,
                    items.map((i, idx) => ({ variantId: i.variantId, mediaIds: [media[idx].id] })),
                );
                for (let idx = 0; idx < items.length; idx++) {
                    const item = items[idx];
                    const cdnUrl = urlByMediaId.get(media[idx].id);
                    uploaded.push({ ...item, mediaId: media[idx].id, cdnUrl });
                    try {
                        await convex.mutation(api.products.setVariantImages, {
                            websiteSku: item.websiteSku,
                            imageUrl: cdnUrl,
                            writeToken: WRITE_TOKEN,
                        });
                        convexPatched.push(item.graceSku);
                    } catch (error) {
                        failed.push({ stage: "convex_patch", graceSku: item.graceSku, error: String(error?.message ?? error) });
                    }
                }
            } catch (error) {
                failed.push({
                    stage: "shopify",
                    productId,
                    skus: items.map((i) => i.graceSku),
                    error: String(error?.message ?? error),
                });
            }
            done += items.length;
            if (!JSON_MODE) console.log(`  …${done}/${selected.length} (${failed.length} failures)`);
            await sleep(300);
        }
    }

    const report = {
        generatedAt: new Date().toISOString(),
        mode: APPLY ? "apply" : "dry-run",
        family: FAMILY ?? "ALL",
        manifest: MANIFEST,
        convexUrl: CONVEX_URL,
        shopifyDomain: SHOPIFY_DOMAIN,
        totals: {
            manifestRows: manifestRows.length,
            eligibleAfterFilters: plan.length,
            selected: selected.length,
            products: byProduct.size,
            uploaded: uploaded.length,
            convexPatched: convexPatched.length,
            failed: failed.length,
            skippedUntrustedSource: skippedUntrustedSource.length,
            skippedUnmatchedSku: skippedUnmatchedSku.length,
            skippedDuplicateSku: skippedDuplicateSku.length,
            skippedAlreadyHasImage: skippedAlreadyHasImage.length,
        },
        samples: {
            plan: selected.slice(0, 15),
            uploaded: uploaded.slice(0, 15),
            failed,
            skippedUntrustedSource: skippedUntrustedSource.slice(0, 10),
            skippedUnmatchedSku: skippedUnmatchedSku.slice(0, 10),
            skippedAlreadyHasImage: skippedAlreadyHasImage.slice(0, 10),
        },
    };

    const outDir = resolve(ROOT, "data/audits/launch-image-worklist-2026-06-12");
    mkdirSync(outDir, { recursive: true });
    const stamp = report.generatedAt.replace(/[:.]/g, "-");
    const reportPath = resolve(outDir, `push_report_${report.mode}_${stamp}.json`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    if (JSON_MODE) {
        console.log(JSON.stringify(report, null, 2));
        return;
    }
    console.log("Generated Media → Shopify → Convex Push");
    console.log("───────────────────────────────────────");
    console.log(`Mode: ${report.mode} | Family: ${report.family}`);
    console.log(`Shopify: ${SHOPIFY_DOMAIN} | Convex: ${CONVEX_URL}`);
    for (const [k, v] of Object.entries(report.totals)) console.log(`${k}: ${v}`);
    console.log(`Report: ${reportPath}`);
    if (!APPLY) console.log("\nDry-run only. Re-run with --apply to upload to Shopify and patch Convex.");
    if (failed.length) {
        console.log("\nFailures:");
        for (const f of failed.slice(0, 10)) console.log(`  [${f.stage}] ${f.skus?.join(",") ?? f.graceSku}: ${f.error}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
