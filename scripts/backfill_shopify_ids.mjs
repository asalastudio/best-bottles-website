#!/usr/bin/env node
/**
 * Backfill Shopify variant / product IDs onto Convex records.
 *
 * Pulls every product + variant from Shopify Admin API, builds a mapping of
 *   handle (slug) → Shopify product GID
 *   sku             → Shopify variant GID + inventoryItem GID
 * and patches:
 *   productGroups.shopifyProductId
 *   products.shopifyVariantId
 *   products.shopifyInventoryItemId
 *
 * Does NOT touch any other catalog fields. Idempotent — skips records already
 * linked to the same GID.
 *
 * Usage:
 *   node scripts/backfill_shopify_ids.mjs                         # dry-run everything
 *   node scripts/backfill_shopify_ids.mjs --family Empire         # dry-run, Empire only
 *   node scripts/backfill_shopify_ids.mjs --apply --family Empire # apply, Empire only
 *   node scripts/backfill_shopify_ids.mjs --apply                 # apply everything
 *
 * --family filters by title prefix on the Shopify side (Shopify titles start
 * with "{size} {color} {family}..."). Safer to run scoped first.
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Load .env.local ──────────────────────────────────────────────────────────
try {
    const envPath = resolve(ROOT, ".env.local");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) {
            const key = m[1].trim();
            if (process.env[key] == null) {
                process.env[key] = m[2].trim().replace(/^["']|["']$/g, "");
            }
        }
    }
} catch { /* ok */ }

// ── Args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const runId = new Date().toISOString().replace(/[:.]/g, "-");
function argVal(name) {
    const i = argv.indexOf(name);
    if (i < 0) return undefined;
    const v = argv[i + 1];
    return v && !v.startsWith("--") ? v : undefined;
}
const args = {
    apply: argv.includes("--apply"),
    family: argVal("--family"),
    limit: Number(argVal("--limit")) || undefined,
    manifestPath: argVal("--manifest") ?? resolve(ROOT, "tmp", "shopify-sync", `backfill-manifest-${runId}.json`),
};

// ── Colors ───────────────────────────────────────────────────────────────────
const G = "\x1b[32m", R = "\x1b[31m", Y = "\x1b[33m", D = "\x1b[2m", B = "\x1b[1m", X = "\x1b[0m";
const ok = (s) => console.log(`${G}✓${X} ${s}`);
const fail = (s) => console.log(`${R}✗${X} ${s}`);
const info = (s) => console.log(`${D}  ${s}${X}`);
const warn = (s) => console.log(`${Y}⚠${X} ${s}`);
const section = (s) => console.log(`\n${B}${s}${X}`);

// ── Env check ────────────────────────────────────────────────────────────────
const REQ = ["NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN", "SHOPIFY_ADMIN_TOKEN", "NEXT_PUBLIC_CONVEX_URL"];
const missing = REQ.filter((k) => !process.env[k]);
if (missing.length) { fail(`Missing env: ${missing.join(", ")}`); process.exit(1); }

const SHOPIFY_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = "2025-01";

function buildManifest() {
    return {
        runId,
        generatedAt: new Date().toISOString(),
        mode: args.apply ? "apply" : "dry-run",
        operation: "backfill-shopify-ids",
        storeDomain: SHOPIFY_DOMAIN,
        filters: {
            family: args.family ?? null,
            limit: args.limit ?? null,
        },
        summary: {
            created: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            productsSeen: 0,
            groupPatchCount: 0,
            variantPatchCount: 0,
            productGroupsUpdated: 0,
            productGroupsAlreadyLinked: 0,
            productGroupsNotFound: 0,
            productsUpdated: 0,
            productsAlreadyLinked: 0,
            productsNotFound: 0,
        },
        rows: [],
    };
}

function writeManifest(manifest) {
    mkdirSync(dirname(args.manifestPath), { recursive: true });
    writeFileSync(args.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function shopify(query, variables) {
    const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": SHOPIFY_TOKEN },
        body: JSON.stringify({ query, variables }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
    const json = JSON.parse(text);
    if (json.errors?.length) throw new Error(`GQL: ${json.errors.map((e) => e.message).join("; ")}`);
    return json.data;
}

// ── Step 1: Pull all products + variants from Shopify ────────────────────────
section("1. Pulling Shopify products");
info(`Store: ${SHOPIFY_DOMAIN}`);
if (args.family) info(`Family filter: ${args.family}`);
info(`Manifest: ${args.manifestPath}`);

const PRODUCTS_QUERY = `
query AllProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
        edges {
            cursor
            node {
                id
                handle
                title
                variants(first: 100) {
                    edges {
                        node {
                            id
                            sku
                            inventoryItem { id }
                        }
                    }
                }
            }
        }
        pageInfo { hasNextPage endCursor }
    }
}`;

/** Shopify query-string filter — title-prefix style match for the family. */
const shopifyQuery = args.family ? `title:*${args.family}*` : undefined;

const groupPatches = []; // { slug, shopifyProductId }
const variantPatches = []; // { sku, shopifyVariantId, shopifyInventoryItemId }
const shopifyProductRows = []; // one row per Shopify product handle

let cursor = undefined;
let productsSeen = 0;
for (;;) {
    const data = await shopify(PRODUCTS_QUERY, { first: 50, after: cursor, query: shopifyQuery });
    for (const edge of data.products.edges) {
        const p = edge.node;
        productsSeen++;
        const variants = p.variants.edges
            .filter((variantEdge) => variantEdge.node.sku)
            .map((variantEdge) => ({
                sku: variantEdge.node.sku,
                shopifyVariantId: variantEdge.node.id,
                shopifyInventoryItemId: variantEdge.node.inventoryItem?.id ?? null,
            }));
        if (p.handle) {
            groupPatches.push({ slug: p.handle, shopifyProductId: p.id });
        }
        shopifyProductRows.push({
            slug: p.handle,
            title: p.title,
            shopifyProductId: p.id,
            variantCount: variants.length,
            variants,
        });
        for (const variant of variants) {
            variantPatches.push({
                sku: variant.sku,
                shopifyVariantId: variant.shopifyVariantId,
                shopifyInventoryItemId: variant.shopifyInventoryItemId ?? undefined,
            });
        }
        if (args.limit && productsSeen >= args.limit) break;
    }
    if (args.limit && productsSeen >= args.limit) break;
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
}

ok(`Pulled ${productsSeen} Shopify products → ${groupPatches.length} group patches, ${variantPatches.length} variant patches`);

const { ConvexHttpClient } = await import("convex/browser");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

async function buildManifestRows(rows) {
    const groups = await convex.query("products:getAllCatalogGroups", {});
    const groupBySlug = new Map(groups.map((group) => [group.slug, group]));

    return Promise.all(rows.map(async (row) => {
        const group = groupBySlug.get(row.slug);
        const convexVariants = group
            ? await convex.query("products:getVariantsForGroup", { groupId: group._id }).catch(() => [])
            : [];
        const byGraceSku = new Map(convexVariants.map((variant) => [variant.graceSku, variant]));
        const byWebsiteSku = new Map(convexVariants.map((variant) => [variant.websiteSku, variant]));

        return {
            slug: row.slug,
            title: row.title,
            status: args.apply ? "pending_apply" : "planned_backfill",
            reason: group ? null : "product_group_not_found",
            productGroupId: group?._id ?? null,
            currentShopifyProductId: group?.shopifyProductId ?? null,
            shopifyProductId: row.shopifyProductId,
            variantCount: row.variantCount,
            variants: row.variants.map((shopifyVariant) => {
                const convexVariant = byGraceSku.get(shopifyVariant.sku) ?? byWebsiteSku.get(shopifyVariant.sku) ?? null;
                return {
                    productId: convexVariant?.productId ?? null,
                    graceSku: convexVariant?.graceSku ?? null,
                    websiteSku: convexVariant?.websiteSku ?? null,
                    sku: shopifyVariant.sku,
                    shopifyVariantId: shopifyVariant.shopifyVariantId,
                    shopifyInventoryItemId: shopifyVariant.shopifyInventoryItemId,
                    currentShopifyVariantId: convexVariant?.shopifyVariantId ?? null,
                    currentShopifyInventoryItemId: convexVariant?.shopifyInventoryItemId ?? null,
                    price: convexVariant?.webPrice1pc ?? null,
                    itemName: convexVariant?.itemName ?? null,
                    matchStatus: convexVariant ? "matched" : "convex_product_not_found",
                };
            }),
        };
    }));
}

const manifest = buildManifest();
manifest.summary.productsSeen = productsSeen;
manifest.summary.groupPatchCount = groupPatches.length;
manifest.summary.variantPatchCount = variantPatches.length;
manifest.rows = await buildManifestRows(shopifyProductRows);
manifest.summary.failed = manifest.rows.reduce((sum, row) => {
    const missingGroup = row.reason ? 1 : 0;
    const missingVariants = row.variants.filter((variant) => variant.matchStatus === "convex_product_not_found").length;
    return sum + missingGroup + missingVariants;
}, 0);

if (!args.apply) {
    section("2. DRY RUN — sample patches");
    console.log(`\n${D}First 3 group patches:${X}`);
    for (const p of groupPatches.slice(0, 3)) console.log("  ", p);
    console.log(`\n${D}First 5 variant patches:${X}`);
    for (const p of variantPatches.slice(0, 5)) console.log("  ", p);
    console.log();
    writeManifest(manifest);
    ok(`Manifest written: ${args.manifestPath}`);
    warn("Dry run only. Re-run with --apply to write.");
    process.exit(0);
}

// ── Step 2: Apply to Convex ──────────────────────────────────────────────────
section("2. Applying to Convex");

const { api } = await import("../convex/_generated/api.js");

async function applyBatches(items, batchSize, runFn, label) {
    let totalUpdated = 0, totalAlready = 0, totalNotFound = 0;
    const notFoundAll = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchIndex = Math.floor(i / batchSize);
        const res = await runFn(batch, batchIndex);
        totalUpdated += res.updated;
        totalAlready += res.alreadyLinked;
        totalNotFound += res.notFound;
        if (res.notFoundSample?.length) notFoundAll.push(...res.notFoundSample);
        info(`${label} batch ${batchIndex + 1}/${Math.ceil(items.length / batchSize)}: +${res.updated} updated, ${res.alreadyLinked} already linked, ${res.notFound} not found`);
    }
    return { totalUpdated, totalAlready, totalNotFound, notFoundSample: notFoundAll.slice(0, 20) };
}

info("Patching productGroups...");
const groupResult = await applyBatches(
    groupPatches,
    100,
    (batch, batchIndex) => convex.action(api.backfillShopifyIds.applyGroupBatch, { patches: batch, batchIndex }),
    "Group",
);
ok(`productGroups: ${groupResult.totalUpdated} updated, ${groupResult.totalAlready} already linked, ${groupResult.totalNotFound} not found`);
if (groupResult.notFoundSample.length) warn(`Not-found slugs (sample): ${groupResult.notFoundSample.join(", ")}`);

info("Patching products...");
const variantResult = await applyBatches(
    variantPatches,
    100,
    (batch, batchIndex) => convex.action(api.backfillShopifyIds.applyVariantBatch, { patches: batch, batchIndex }),
    "Variant",
);
ok(`products: ${variantResult.totalUpdated} updated, ${variantResult.totalAlready} already linked, ${variantResult.totalNotFound} not found`);
if (variantResult.notFoundSample.length) warn(`Not-found SKUs (sample): ${variantResult.notFoundSample.join(", ")}`);

manifest.summary.updated = groupResult.totalUpdated + variantResult.totalUpdated;
manifest.summary.skipped = groupResult.totalAlready + variantResult.totalAlready;
manifest.summary.failed = groupResult.totalNotFound + variantResult.totalNotFound;
manifest.summary.productGroupsUpdated = groupResult.totalUpdated;
manifest.summary.productGroupsAlreadyLinked = groupResult.totalAlready;
manifest.summary.productGroupsNotFound = groupResult.totalNotFound;
manifest.summary.productsUpdated = variantResult.totalUpdated;
manifest.summary.productsAlreadyLinked = variantResult.totalAlready;
manifest.summary.productsNotFound = variantResult.totalNotFound;
manifest.rows = manifest.rows.map((row) => ({
    ...row,
    status: row.reason ? "failed" : "applied",
}));
writeManifest(manifest);
ok(`Manifest written: ${args.manifestPath}`);

section("Done.");
