#!/usr/bin/env node
/**
 * Read-only Madison/Supabase ↔ Best Bottles Convex image truth audit.
 *
 * Madison Studio is the upstream place where Best Bottles image/reference work
 * is generated and approved. This script compares Madison Supabase rows against
 * Best Bottles Convex rows without writing to Supabase, Shopify, Sanity, or
 * Convex.
 *
 * Examples:
 *   npm run audit:madison-supabase
 *   npm run audit:madison-supabase -- --family Empire
 *   npm run audit:madison-supabase -- --tables best_bottles_pipeline_groups
 *   npm run audit:madison-supabase -- --json
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const DEFAULT_MADISON_REPO =
    "/Users/jordanrichter/Projects/Madison Studio/madison-app";
const DEFAULT_ORG_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const DEFAULT_CONVEX_PRODUCTION_URL = "https://precise-raccoon-123.convex.cloud";
const DEFAULT_TABLES = [
    "best_bottles_pipeline_groups",
    "paper_doll_approved_assets",
    "best_bottles_pipeline_sku_jobs",
    "shopify_publish_log",
];

const IDENTITY_FIELDS = [
    "convex_slug",
    "product_group_slug",
    "productGroupSlug",
    "group_slug",
    "slug",
    "website_sku",
    "websiteSku",
    "grace_sku",
    "graceSku",
    "shopify_sku",
    "shopifySku",
];

const IMAGE_FIELDS = [
    "hero_image_url",
    "heroImageUrl",
    "legacy_hero_image_url",
    "legacyHeroImageUrl",
    "image_url",
    "imageUrl",
    "source_image_url",
    "sourceImageUrl",
    "shopify_image_url",
    "shopifyImageUrl",
    "reference_image_url",
    "referenceImageUrl",
    "asset_url",
    "assetUrl",
    "url",
    "madison_approved_image_url",
];

function loadEnvFile(filePath) {
    if (!existsSync(filePath)) return;
    const raw = readFileSync(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx < 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if (
            (value.startsWith("\"") && value.endsWith("\"")) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        const commentIdx = value.indexOf(" #");
        if (commentIdx >= 0) value = value.slice(0, commentIdx).trim();
        if (!process.env[key]) process.env[key] = value;
    }
}

function loadEnvironment(madisonRepo) {
    loadEnvFile(resolve(".env.local"));
    loadEnvFile(resolve(madisonRepo, ".env.local"));
    loadEnvFile(resolve(madisonRepo, ".env"));
}

function parseArgs() {
    const args = process.argv.slice(2);
    const get = (name, fallback = null) => {
        const idx = args.indexOf(name);
        return idx >= 0 ? args[idx + 1] ?? fallback : fallback;
    };
    const tablesArg = get("--tables", null);
    return {
        madisonRepo: get("--madison-repo", process.env.MADISON_REPO_PATH || DEFAULT_MADISON_REPO),
        supabaseUrl: get("--supabase-url", process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
        supabaseKey: get(
            "--supabase-key",
            process.env.SUPABASE_SERVICE_ROLE_KEY ||
                process.env.SUPABASE_ANON_KEY ||
                process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        ),
        orgId: get("--org-id", process.env.MADISON_BEST_BOTTLES_ORG_ID || DEFAULT_ORG_ID),
        family: get("--family", null),
        limit: Number(get("--limit", process.env.MADISON_SUPABASE_AUDIT_LIMIT || "1000")),
        tables: tablesArg
            ? tablesArg.split(",").map((table) => table.trim()).filter(Boolean)
            : DEFAULT_TABLES,
        convexUrl: get(
            "--convex-url",
            process.env.NEXT_PUBLIC_CONVEX_URL || DEFAULT_CONVEX_PRODUCTION_URL,
        ),
        productionConvexUrl: get("--production-convex-url", DEFAULT_CONVEX_PRODUCTION_URL),
        json: args.includes("--json"),
    };
}

function normalizeUrl(value) {
    return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
}

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeSku(value) {
    return normalizeText(value).toUpperCase();
}

function getNestedValue(record, path) {
    const parts = path.split(".");
    let current = record;
    for (const part of parts) {
        if (!current || typeof current !== "object") return undefined;
        current = current[part];
    }
    return current;
}

function firstString(record, fields) {
    for (const field of fields) {
        const value = getNestedValue(record, field);
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
}

function collectImageValues(value, path = "", out = []) {
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (/^https?:\/\//i.test(trimmed)) {
            const lastPath = path.split(".").pop() ?? "";
            if (
                IMAGE_FIELDS.includes(path) ||
                IMAGE_FIELDS.includes(lastPath) ||
                /\.(png|jpe?g|webp|gif)(\?|$)/i.test(trimmed) ||
                /cdn|storage|supabase|shopify|sanity/i.test(trimmed)
            ) {
                out.push({ field: path, url: trimmed });
            }
        }
        return out;
    }

    if (Array.isArray(value)) {
        value.forEach((item, idx) => collectImageValues(item, `${path}.${idx}`.replace(/^\./, ""), out));
        return out;
    }

    if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
            collectImageValues(child, `${path}.${key}`.replace(/^\./, ""), out);
        }
    }

    return out;
}

function extractRecordFacts(table, row) {
    const publishedContent =
        row && typeof row === "object" && row.published_content && typeof row.published_content === "object"
            ? row.published_content
            : {};
    const bestBottlesConvex =
        publishedContent.bestBottlesConvex && typeof publishedContent.bestBottlesConvex === "object"
            ? publishedContent.bestBottlesConvex
            : {};
    const candidates = { ...publishedContent, ...bestBottlesConvex, ...row };
    const slug = firstString(candidates, [
        "convex_slug",
        "product_group_slug",
        "productGroupSlug",
        "group_slug",
        "slug",
    ]);
    const websiteSku = firstString(candidates, ["website_sku", "websiteSku"]);
    const graceSku = firstString(candidates, ["grace_sku", "graceSku"]);
    const shopifySku = firstString(candidates, ["shopify_sku", "shopifySku", "matchedShopifySku", "sku"]);
    const imageCandidates = collectImageValues(row).filter((entry) => {
        if (table === "shopify_publish_log") {
            return /published_content|shopify|image/i.test(entry.field);
        }
        return true;
    });

    return {
        id: normalizeText(row.id),
        table,
        slug,
        websiteSku: websiteSku || firstString(candidates, ["primary_website_sku", "primaryWebsiteSku"]),
        graceSku: graceSku || firstString(candidates, ["primary_grace_sku", "primaryGraceSku"]),
        shopifySku,
        status: firstString(candidates, [
            "status",
            "review_status",
            "reviewStatus",
            "approval_status",
            "approvalStatus",
        ]),
        approved:
            row.approved === true ||
            row.is_approved === true ||
            row.isApproved === true ||
            /approved|success/i.test(firstString(candidates, ["status", "review_status", "reviewStatus"])),
        imageCandidates,
        madisonStatus: firstString(candidates, ["madison_status", "madisonStatus"]),
        madisonApprovedImageId: firstString(candidates, [
            "madison_approved_image_id",
            "madisonApprovedImageId",
        ]),
        madisonConvexSyncedAt: firstString(candidates, [
            "madison_convex_synced_at",
            "madisonConvexSyncedAt",
        ]),
        madisonShopifySyncedAt: firstString(candidates, [
            "madison_shopify_synced_at",
            "madisonShopifySyncedAt",
        ]),
        madisonLastError: firstString(candidates, ["madison_last_error", "madisonLastError"]),
        createdAt: firstString(row, ["created_at", "createdAt"]),
        updatedAt: firstString(row, ["updated_at", "updatedAt"]),
    };
}

function postgrestValue(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/,/g, "\\,");
}

async function fetchJson(url, headers) {
    const response = await fetch(url, { method: "GET", headers });
    const text = await response.text();
    let body = null;
    try {
        body = text ? JSON.parse(text) : null;
    } catch {
        body = text;
    }
    if (!response.ok) {
        const message =
            body && typeof body === "object" && "message" in body
                ? body.message
                : text || response.statusText;
        const error = new Error(`${response.status} ${message}`);
        error.status = response.status;
        error.body = body;
        throw error;
    }
    return body;
}

async function fetchSupabaseTable({ supabaseUrl, supabaseKey, table, orgId, limit }) {
    const headers = {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: "application/json",
    };
    const base = `${normalizeUrl(supabaseUrl)}/rest/v1/${encodeURIComponent(table)}`;
    const select = "select=*";
    const order = "order=updated_at.desc.nullslast,created_at.desc.nullslast";
    const limited = `limit=${encodeURIComponent(String(limit))}`;

    const tryUrls = [];
    if (orgId) {
        tryUrls.push(`${base}?${select}&organization_id=eq.${postgrestValue(orgId)}&${order}&${limited}`);
        tryUrls.push(`${base}?${select}&org_id=eq.${postgrestValue(orgId)}&${order}&${limited}`);
    }
    tryUrls.push(`${base}?${select}&${order}&${limited}`);
    tryUrls.push(`${base}?${select}&${limited}`);

    const attempts = [];
    for (const url of tryUrls) {
        try {
            const rows = await fetchJson(url, headers);
            return Array.isArray(rows) ? rows : [];
        } catch (error) {
            attempts.push(error.message);
            if (
                !/column .* does not exist|PGRST/i.test(error.message) &&
                !/updated_at|created_at|organization_id|org_id/i.test(error.message)
            ) {
                throw error;
            }
        }
    }

    throw new Error(`Unable to query ${table}: ${attempts.join(" | ")}`);
}

async function fetchSupabaseRowsByIds({ supabaseUrl, supabaseKey, table, ids, select = "*" }) {
    const uniqueIds = Array.from(new Set(ids.map(normalizeText).filter(Boolean)));
    if (uniqueIds.length === 0) return [];
    const headers = {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: "application/json",
    };
    const rows = [];
    const base = `${normalizeUrl(supabaseUrl)}/rest/v1/${encodeURIComponent(table)}`;
    for (let i = 0; i < uniqueIds.length; i += 100) {
        const chunk = uniqueIds.slice(i, i + 100).map(postgrestValue).join(",");
        const url = `${base}?select=${encodeURIComponent(select)}&id=in.(${chunk})`;
        const data = await fetchJson(url, headers);
        if (Array.isArray(data)) rows.push(...data);
    }
    return rows;
}

function getFamilyValue(row) {
    if (!row || typeof row !== "object") return "";
    const direct = firstString(row, ["family", "product_family", "productFamily"]);
    if (direct) return direct;
    const publishedContent = row.published_content && typeof row.published_content === "object"
        ? row.published_content
        : {};
    const pipelineSkuJob =
        publishedContent.pipelineSkuJob && typeof publishedContent.pipelineSkuJob === "object"
            ? publishedContent.pipelineSkuJob
            : {};
    return firstString({ ...publishedContent, ...pipelineSkuJob }, [
        "family",
        "product_family",
        "productFamily",
    ]);
}

function getSlugLikeValue(row) {
    if (!row || typeof row !== "object") return "";
    const publishedContent = row.published_content && typeof row.published_content === "object"
        ? row.published_content
        : {};
    const pipelineSkuJob =
        publishedContent.pipelineSkuJob && typeof publishedContent.pipelineSkuJob === "object"
            ? publishedContent.pipelineSkuJob
            : {};
    return firstString({ ...publishedContent, ...pipelineSkuJob, ...row }, [
        "convex_slug",
        "product_group_slug",
        "productGroupSlug",
        "group_slug",
        "slug",
    ]);
}

function rowMatchesFamily(row, family) {
    if (!family) return true;
    const expected = family.trim().toLowerCase();
    if (!expected) return true;
    const rowFamily = getFamilyValue(row).toLowerCase();
    if (rowFamily) return rowFamily === expected;
    return getSlugLikeValue(row).toLowerCase().startsWith(`${expected}-`);
}

async function loadConvexCatalog(convexUrl, family) {
    const client = new ConvexHttpClient(convexUrl);
    const groups = family
        ? await client.query(api.products.getProductGroupsByFamily, { family })
        : await client.query(api.products.getAllCatalogGroups, {});
    const groupBySlug = new Map();
    const productByWebsiteSku = new Map();
    const productByGraceSku = new Map();

    for (const group of groups) {
        if (group?.slug) groupBySlug.set(group.slug, group);
        if (!group?.slug) continue;
        try {
            const detail = await client.query(api.products.getProductGroup, { slug: group.slug });
            for (const variant of detail?.variants ?? []) {
                if (variant.websiteSku) productByWebsiteSku.set(normalizeSku(variant.websiteSku), variant);
                if (variant.graceSku) productByGraceSku.set(normalizeSku(variant.graceSku), variant);
            }
        } catch {
            /* keep the audit moving; missing variant details become unknowns */
        }
    }

    return {
        url: convexUrl,
        groups,
        groupBySlug,
        productByWebsiteSku,
        productByGraceSku,
    };
}

function imageMatchesConvex(images, convexRecord, fields) {
    if (!convexRecord) return false;
    const convexUrls = fields
        .map((field) => normalizeText(convexRecord[field]))
        .filter(Boolean);
    return images.some((image) => convexUrls.includes(image.url));
}

function summarizeFacts(fact, convexCatalog) {
    const group = fact.slug ? convexCatalog.groupBySlug.get(fact.slug) : null;
    const product =
        (fact.websiteSku ? convexCatalog.productByWebsiteSku.get(normalizeSku(fact.websiteSku)) : null) ||
        (fact.graceSku ? convexCatalog.productByGraceSku.get(normalizeSku(fact.graceSku)) : null) ||
        (fact.shopifySku ? convexCatalog.productByWebsiteSku.get(normalizeSku(fact.shopifySku)) : null) ||
        (fact.shopifySku ? convexCatalog.productByGraceSku.get(normalizeSku(fact.shopifySku)) : null) ||
        null;

    return {
        groupMatched: Boolean(group),
        productMatched: Boolean(product),
        groupHeroMatches: imageMatchesConvex(fact.imageCandidates, group, ["heroImageUrl"]),
        productImageMatches: imageMatchesConvex(fact.imageCandidates, product, ["imageUrl", "imageUrlCapOff"]),
        groupHeroUrl: group?.heroImageUrl ?? null,
        productImageUrl: product?.imageUrl ?? null,
        productImageUrlCapOff: product?.imageUrlCapOff ?? null,
    };
}

function hasKnownBestBottlesIdentity(fact) {
    return Boolean(fact.slug || fact.websiteSku || fact.graceSku || fact.shopifySku);
}

function hasImageInFields(fact, fields) {
    return fact.imageCandidates.some((image) => fields.some((field) => image.field.endsWith(field)));
}

function buildIssues(fact, targetSummary, productionSummary) {
    const issues = [];
    if (!hasKnownBestBottlesIdentity(fact)) {
        issues.push("missing_slug_or_sku");
    }
    if (fact.slug && !targetSummary.groupMatched) {
        issues.push("slug_not_found_in_target_convex");
    }
    if ((fact.websiteSku || fact.graceSku || fact.shopifySku) && !targetSummary.productMatched) {
        issues.push("sku_not_found_in_target_convex");
    }
    if (fact.table === "best_bottles_pipeline_groups") {
        const isApproved = /approved/i.test(fact.madisonStatus) || Boolean(fact.madisonApprovedImageId);
        if (isApproved && fact.madisonApprovedImageId && !hasImageInFields(fact, ["madison_approved_image_url"])) {
            issues.push("approved_madison_image_not_resolved");
        }
        if (isApproved && !fact.madisonConvexSyncedAt) {
            issues.push("approved_madison_group_not_synced_to_convex");
        }
        if (isApproved && targetSummary.groupMatched && !targetSummary.groupHeroUrl) {
            issues.push("approved_madison_group_has_no_target_convex_hero");
        }
        if (fact.madisonLastError) {
            issues.push("madison_pipeline_last_error_present");
        }
        return issues;
    }

    if (fact.table === "shopify_publish_log" && fact.imageCandidates.length > 0 && targetSummary.productMatched && !targetSummary.productImageMatches) {
        issues.push("target_product_image_does_not_match_madison_image");
    }
    if (fact.table === "shopify_publish_log" &&
        fact.slug &&
        productionSummary.groupMatched &&
        productionSummary.groupHeroMatches &&
        !targetSummary.groupHeroMatches
    ) {
        issues.push("present_in_production_convex_missing_in_target_convex");
    }
    return issues;
}

function printReport(report) {
    if (report.options.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
    }

    console.log("Madison Supabase Image Truth Audit");
    console.log("──────────────────────────────────");
    console.log(`Supabase: ${report.supabase.projectUrl}`);
    console.log(`Organization: ${report.options.orgId}`);
    console.log(`Target Convex: ${report.options.convexUrl}`);
    console.log(`Production Convex: ${report.options.productionConvexUrl}`);
    console.log(`Family filter: ${report.options.family ?? "ALL"}`);
    console.log(`Tables: ${report.options.tables.join(", ")}`);
    console.log("");
    console.log(`Rows fetched before family filter: ${report.counts.rowsFetchedBeforeFamilyFilter}`);
    console.log(`Rows audited: ${report.counts.rowsRead}`);
    console.log(`Rows with Best Bottles slug/SKU: ${report.counts.rowsWithIdentity}`);
    console.log(`Rows with image URLs: ${report.counts.rowsWithImages}`);
    console.log(`Approved Madison generated images resolved: ${report.counts.approvedGeneratedImagesResolved}`);
    console.log(`Target Convex groups loaded: ${report.counts.targetConvexGroups}`);
    console.log(`Production Convex groups loaded: ${report.counts.productionConvexGroups}`);
    console.log("");
    console.log("Issues");
    for (const [issue, count] of Object.entries(report.counts.issues)) {
        console.log(`  ${issue}: ${count}`);
    }
    if (Object.keys(report.counts.issues).length === 0) {
        console.log("  None detected in sampled rows.");
    }

    if (report.samples.length) {
        console.log("");
        console.log("Sample flagged rows");
        for (const sample of report.samples.slice(0, 12)) {
            console.log(
                `  ${sample.table}:${sample.id || "(no id)"} ` +
                    `${sample.slug || sample.websiteSku || sample.graceSku || sample.shopifySku || "(no identity)"} ` +
                    `→ ${sample.issues.join(", ")}`,
            );
        }
    }

    console.log("");
    console.log("Read-only audit complete. No Supabase, Convex, Shopify, or Sanity writes were performed.");
}

async function main() {
    const initialOptions = parseArgs();
    loadEnvironment(initialOptions.madisonRepo);
    const options = parseArgs();

    if (!options.supabaseUrl || !options.supabaseKey) {
        console.error(
            "Missing Supabase connection. Set SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY, " +
                "or VITE_SUPABASE_URL plus VITE_SUPABASE_PUBLISHABLE_KEY.",
        );
        process.exit(1);
    }
    if (!options.convexUrl) {
        console.error("Missing target Convex URL. Set NEXT_PUBLIC_CONVEX_URL or pass --convex-url.");
        process.exit(1);
    }

    const tableResults = [];
    for (const table of options.tables) {
        try {
            const rows = await fetchSupabaseTable({
                supabaseUrl: options.supabaseUrl,
                supabaseKey: options.supabaseKey,
                table,
                orgId: options.orgId,
                limit: options.limit,
            });
            tableResults.push({ table, rows, error: null });
        } catch (error) {
            tableResults.push({ table, rows: [], error: error.message });
        }
    }

    const [targetCatalog, productionCatalog] = await Promise.all([
        loadConvexCatalog(options.convexUrl, options.family),
        loadConvexCatalog(options.productionConvexUrl, options.family),
    ]);

    const approvedImageIds = tableResults.flatMap((result) =>
        result.rows
            .map((row) => normalizeText(row.madison_approved_image_id))
            .filter(Boolean),
    );
    let generatedImageById = new Map();
    try {
        const generatedImages = await fetchSupabaseRowsByIds({
            supabaseUrl: options.supabaseUrl,
            supabaseKey: options.supabaseKey,
            table: "generated_images",
            ids: approvedImageIds,
            select: "id,image_url,session_name,organization_id,user_id,created_at",
        });
        generatedImageById = new Map(generatedImages.map((image) => [image.id, image]));
    } catch {
        generatedImageById = new Map();
    }

    const rows = tableResults.flatMap((result) =>
        result.rows
            .filter((row) => rowMatchesFamily(row, options.family))
            .map((row) => {
                const approvedImageId = normalizeText(row.madison_approved_image_id);
                const approvedImage = approvedImageId ? generatedImageById.get(approvedImageId) : null;
                return {
                    table: result.table,
                    row: approvedImage?.image_url
                        ? { ...row, madison_approved_image_url: approvedImage.image_url }
                        : row,
                };
            }),
    );
    const facts = rows.map(({ table, row }) => extractRecordFacts(table, row));
    const audited = facts.map((fact) => {
        const target = summarizeFacts(fact, targetCatalog);
        const production = summarizeFacts(fact, productionCatalog);
        const issues = buildIssues(fact, target, production);
        return { ...fact, target, production, issues };
    });

    const issueCounts = {};
    for (const row of audited) {
        for (const issue of row.issues) issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
    }

    const report = {
        supabase: {
            projectUrl: normalizeUrl(options.supabaseUrl),
            keyType: process.env.SUPABASE_SERVICE_ROLE_KEY ? "service_role_or_supplied" : "publishable_or_anon",
        },
        options: {
            ...options,
            supabaseKey: "[redacted]",
            json: options.json,
        },
        tableStatus: tableResults.map((result) => ({
            table: result.table,
            rows: result.rows.length,
            error: result.error,
        })),
        counts: {
            rowsFetchedBeforeFamilyFilter: tableResults.reduce((sum, result) => sum + result.rows.length, 0),
            rowsRead: facts.length,
            rowsWithIdentity: facts.filter(hasKnownBestBottlesIdentity).length,
            rowsWithImages: facts.filter((fact) => fact.imageCandidates.length > 0).length,
            approvedGeneratedImagesResolved: generatedImageById.size,
            targetConvexGroups: targetCatalog.groups.length,
            productionConvexGroups: productionCatalog.groups.length,
            issues: issueCounts,
        },
        samples: audited
            .filter((row) => row.issues.length > 0)
            .slice(0, 25)
            .map((row) => ({
                table: row.table,
                id: row.id,
                slug: row.slug,
                websiteSku: row.websiteSku,
                graceSku: row.graceSku,
                shopifySku: row.shopifySku,
                imageFields: row.imageCandidates.slice(0, 4).map((image) => image.field),
                issues: row.issues,
                target: row.target,
                production: row.production,
            })),
    };

    printReport(report);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
