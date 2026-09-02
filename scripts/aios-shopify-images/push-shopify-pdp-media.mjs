#!/usr/bin/env node
/**
 * Push generated PDP media (Madison/GPT Image 2 renders) to Shopify and
 * surface them in the UI.
 *
 * Per manifest row this script:
 *   0. runs a bone-background QA gate on the evidence image and skips any
 *      candidate whose canvas isn't on-brand cream/bone (or transparent) —
 *      bypass with --skip-bg-gate, loosen with --bg-gate-allow-review,
 *   1. uploads the evidence image to the Shopify product (productCreateMedia,
 *      Shopify fetches the public URL itself),
 *   2. waits for media processing to finish,
 *   3. attaches the media to the variant matched by graceSku === variant.sku.
 *      Variants with no image are appended via productVariantAppendMedia.
 *      With --replace, a variant that ALREADY has an image is repointed onto
 *      the freshly-created media via productVariantsBulkUpdate — a plain append
 *      there is rejected by Shopify ("the given variant already has attached
 *      media"), which is the bug the old --replace path tripped on,
 *   4. patches Convex `imageUrl` with the resulting cdn.shopify.com URL so the
 *      catalog/PDP Shopify-CDN gate passes.
 *
 * Dry-run by default. Idempotent: variants that already carry a Shopify
 * variant image are skipped unless --replace is passed; with --replace they are
 * repointed in place onto the new media (no orphan/duplicate media — the media
 * just created is reused). Pass --delete-old-media to also remove the
 * now-detached old gallery media (best-effort; off by default to stay safe).
 *
 * Usage:
 *   node scripts/aios-shopify-images/push-shopify-pdp-media.mjs
 *   node scripts/aios-shopify-images/push-shopify-pdp-media.mjs --family Cylinder --limit 5 --apply
 *   node scripts/aios-shopify-images/push-shopify-pdp-media.mjs --manifest path/to.csv --apply
 *   node scripts/aios-shopify-images/push-shopify-pdp-media.mjs --family Cylinder --replace --apply
 *   node scripts/aios-shopify-images/push-shopify-pdp-media.mjs --replace --limit 1   # dry-run replace plan
 *   node scripts/aios-shopify-images/push-shopify-pdp-media.mjs --manifest path/to.csv --allow-shopify-cdn-evidence --apply
 *   node scripts/aios-shopify-images/push-shopify-pdp-media.mjs --json > report.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import { gateImageUrl, gatePasses } from "./bg-qa-gate.mjs";
import { planVariantAction, mediaFilename } from "./replace-plan.mjs";

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
// With --replace, also delete the old gallery media that each repointed variant
// used to show. Best-effort and off by default — it is a destructive Shopify
// op, so opt in explicitly once you trust the replace plan.
const DELETE_OLD_MEDIA = process.argv.includes("--delete-old-media");
const JSON_MODE = process.argv.includes("--json");
const ALLOW_SHOPIFY_CDN_EVIDENCE = process.argv.includes("--allow-shopify-cdn-evidence");
// Bone-background QA gate: on by default; rejects non-cream/bone canvases before
// they reach Shopify. --skip-bg-gate bypasses it; --bg-gate-allow-review lets
// ambiguous/undecodable images through instead of holding them back.
const SKIP_BG_GATE = process.argv.includes("--skip-bg-gate");
const ALLOW_REVIEW = process.argv.includes("--bg-gate-allow-review");
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

// Repoint variants that already carry an image onto freshly-created media.
// productVariantAppendMedia refuses these ("already has attached media"); the
// bulk update replaces the variant→media association in place.
async function bulkUpdateVariantMedia(productId, variants) {
    const data = await shopifyGraphQL(
        `mutation BulkUpdateVariantMedia($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants { id sku image { url } }
            userErrors { field message }
          }
        }`,
        { productId, variants },
    );
    const payload = data.productVariantsBulkUpdate;
    if (payload.userErrors?.length) {
        throw new Error(payload.userErrors.map((e) => `${(e.field ?? []).join(".")}: ${e.message}`).join("; "));
    }
    return payload.productVariants;
}

async function fetchProductMedia(productId) {
    const data = await shopifyGraphQL(
        `query ProductMedia($id: ID!) {
          node(id: $id) {
            ... on Product {
              media(first: 250) { nodes { ... on MediaImage { id status image { url } } } }
            }
          }
        }`,
        { id: productId },
    );
    return (data.node?.media?.nodes ?? []).filter((m) => m && m.id);
}

async function deleteProductMedia(productId, mediaIds) {
    const data = await shopifyGraphQL(
        `mutation DeleteProductMedia($productId: ID!, $mediaIds: [ID!]!) {
          productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
            deletedMediaIds
            mediaUserErrors { field message }
          }
        }`,
        { productId, mediaIds },
    );
    const payload = data.productDeleteMedia;
    if (payload.mediaUserErrors?.length) {
        throw new Error(payload.mediaUserErrors.map((e) => e.message).join("; "));
    }
    return payload.deletedMediaIds ?? [];
}

async function main() {
    const manifestRows = parseCsv(readFileSync(MANIFEST, "utf8"));
    const convex = new ConvexHttpClient(CONVEX_URL);
    const trustedEvidenceHosts = new Set(ALLOWED_EVIDENCE_HOSTS);
    if (ALLOW_SHOPIFY_CDN_EVIDENCE) trustedEvidenceHosts.add("cdn.shopify.com");

    // Filter manifest to trusted generated evidence.
    const skippedUntrustedSource = [];
    let rows = manifestRows.filter((r) => {
        if (FAMILY && r.family !== FAMILY) return false;
        const h = host(r.coverageEvidenceUrl);
        if (!h || !trustedEvidenceHosts.has(h)) {
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
        const action = planVariantAction(variant, REPLACE); // "append" | "repoint" | "skip"
        if (action === "skip") {
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
            action,                                  // append a new image or repoint onto it
            oldImageUrl: variant.image?.url ?? null, // present only for repoint (old gallery media to clean up)
        });
    }

    const selectedRaw = LIMIT > 0 ? plan.slice(0, LIMIT) : plan;

    // ── Bone-background QA gate ───────────────────────────────────────────────
    // Decode each candidate and reject anything whose canvas isn't the on-brand
    // cream/bone studio background (or a transparent cutout). This is the guard
    // that stops white-canvas masters from leaking to Shopify the way the
    // original bulk push did (~50% landed white). Runs in dry-run too so the
    // report shows exactly what would be held back.
    const skippedOffBrandBackground = [];
    let selected = selectedRaw;
    if (!SKIP_BG_GATE && selectedRaw.length) {
        const passed = [];
        let cursor = 0;
        const worker = async () => {
            while (cursor < selectedRaw.length) {
                const item = selectedRaw[cursor++];
                const result = await gateImageUrl(item.evidenceUrl);
                if (gatePasses(result, { allowReview: ALLOW_REVIEW })) {
                    passed.push(item);
                } else {
                    skippedOffBrandBackground.push({
                        graceSku: item.graceSku,
                        family: item.family,
                        verdict: result.verdict,
                        bg: result.bg,
                        reason: result.reason,
                        evidenceUrl: item.evidenceUrl,
                    });
                }
            }
        };
        await Promise.all(Array.from({ length: 8 }, worker));
        selected = passed;
        if (!JSON_MODE) {
            console.log(`Bone-bg QA gate: ${passed.length} passed, ${skippedOffBrandBackground.length} rejected of ${selectedRaw.length} checked${ALLOW_REVIEW ? " (review allowed)" : ""}.`);
        }
    }

    // Group by product so each product gets one create + one append call.
    const byProduct = new Map();
    for (const item of selected) {
        const group = byProduct.get(item.productId) ?? [];
        group.push(item);
        byProduct.set(item.productId, group);
    }

    const uploaded = [];
    const convexPatched = [];
    const deletedOldMedia = [];
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

                // New media is matched to its variant by array index. Variants
                // with no image are appended; variants that already carry one are
                // repointed onto the new media (append would be rejected). Both
                // reference the SAME media we just created — no orphan/duplicate.
                const appendInputs = [];
                const repointInputs = [];
                for (let idx = 0; idx < items.length; idx++) {
                    const newMediaId = media[idx].id;
                    if (items[idx].action === "repoint") {
                        repointInputs.push({ id: items[idx].variantId, mediaId: newMediaId });
                    } else {
                        appendInputs.push({ variantId: items[idx].variantId, mediaIds: [newMediaId] });
                    }
                }
                if (appendInputs.length) await appendVariantMedia(productId, appendInputs);
                if (repointInputs.length) await bulkUpdateVariantMedia(productId, repointInputs);

                // Optional cleanup: delete the old gallery media each repointed
                // variant used to show, so --replace doesn't leave orphans behind.
                // Guarded — never touches the media we just created, and only
                // deletes media still named after a replaced variant's old image.
                if (DELETE_OLD_MEDIA && repointInputs.length) {
                    try {
                        const newMediaIds = new Set(media.map((m) => m.id));
                        const oldNames = new Set(
                            items
                                .filter((i) => i.action === "repoint" && i.oldImageUrl)
                                .map((i) => mediaFilename(i.oldImageUrl))
                                .filter(Boolean),
                        );
                        const productMedia = await fetchProductMedia(productId);
                        const deletable = productMedia
                            .filter((m) => !newMediaIds.has(m.id) && oldNames.has(mediaFilename(m.image?.url)))
                            .map((m) => m.id);
                        if (deletable.length) {
                            const deleted = await deleteProductMedia(productId, deletable);
                            deletedOldMedia.push(...deleted);
                        }
                    } catch (error) {
                        // Cleanup is best-effort; a failure here never fails the push.
                        failed.push({ stage: "delete_old_media", productId, error: String(error?.message ?? error) });
                    }
                }

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

    // How the selected rows split across the two attach paths — the headline
    // numbers for validating a --replace run (e.g. `--replace --limit 1`).
    const toAppend = selected.filter((i) => i.action === "append").length;
    const toRepoint = selected.filter((i) => i.action === "repoint").length;

    const report = {
        generatedAt: new Date().toISOString(),
        mode: APPLY ? "apply" : "dry-run",
        family: FAMILY ?? "ALL",
        replace: REPLACE,
        deleteOldMedia: DELETE_OLD_MEDIA,
        allowShopifyCdnEvidence: ALLOW_SHOPIFY_CDN_EVIDENCE,
        manifest: MANIFEST,
        convexUrl: CONVEX_URL,
        shopifyDomain: SHOPIFY_DOMAIN,
        totals: {
            manifestRows: manifestRows.length,
            eligibleAfterFilters: plan.length,
            selected: selected.length,
            toAppend,
            toRepoint,
            bgGateChecked: SKIP_BG_GATE ? 0 : selectedRaw.length,
            skippedOffBrandBackground: skippedOffBrandBackground.length,
            products: byProduct.size,
            uploaded: uploaded.length,
            convexPatched: convexPatched.length,
            deletedOldMedia: deletedOldMedia.length,
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
            skippedOffBrandBackground: skippedOffBrandBackground.slice(0, 15),
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
