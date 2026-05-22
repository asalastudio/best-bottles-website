#!/usr/bin/env node
/**
 * Read-only Madison image/SKU naming audit.
 *
 * Checks whether Madison's Best Bottles image workflow rows carry a consistent
 * SKU identity across pipeline groups, SKU jobs, approved assets, generated
 * image labels, reference paths, and Shopify publish logs.
 *
 * Canonical rule for this audit:
 *   - Render/source image files should be labeled by grace_sku/shopify_sku.
 *   - website_sku is accepted as the Best Bottles UI/Convex crosswalk.
 *   - Group/component imagery should carry product_group_slug/cohort_slug.
 *
 * This script performs no writes.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, relative, resolve } from "node:path";

const DEFAULT_MADISON_REPO =
    "/Users/jordanrichter/Projects/Madison Studio/madison-app";
const DEFAULT_ORG_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const DEFAULT_LIMIT = 1000;

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
        folder: get("--folder", null),
        limit: Number(get("--limit", process.env.MADISON_NAMING_AUDIT_LIMIT || String(DEFAULT_LIMIT))),
        json: args.includes("--json"),
    };
}

function normalizeUrl(value) {
    return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
}

function clean(value) {
    return typeof value === "string" ? value.trim() : "";
}

function compact(value) {
    return clean(value).replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function slugifyLoose(value) {
    return clean(value)
        .toLowerCase()
        .replace(/[_\s]+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

function urlBasename(value) {
    const raw = clean(value);
    if (!raw) return "";
    try {
        const url = new URL(raw);
        return decodeURIComponent(basename(url.pathname));
    } catch {
        return basename(raw.split(/[?#]/)[0]);
    }
}

function getPublishedContent(row) {
    return row?.published_content && typeof row.published_content === "object"
        ? row.published_content
        : {};
}

function getPipelineSkuJobFromPublishLog(row) {
    const content = getPublishedContent(row);
    return content.pipelineSkuJob && typeof content.pipelineSkuJob === "object"
        ? content.pipelineSkuJob
        : {};
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
        throw new Error(`${response.status} ${message}`);
    }
    return body;
}

async function fetchTable({ supabaseUrl, supabaseKey, table, orgId, limit, order = "updated_at.desc.nullslast,created_at.desc.nullslast" }) {
    const headers = {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: "application/json",
    };
    const base = `${normalizeUrl(supabaseUrl)}/rest/v1/${encodeURIComponent(table)}`;
    const urls = [
        `${base}?select=*&organization_id=eq.${postgrestValue(orgId)}&order=${encodeURIComponent(order)}&limit=${limit}`,
        `${base}?select=*&organization_id=eq.${postgrestValue(orgId)}&limit=${limit}`,
        `${base}?select=*&limit=${limit}`,
    ];

    const attempts = [];
    for (const url of urls) {
        try {
            const rows = await fetchJson(url, headers);
            return Array.isArray(rows) ? rows : [];
        } catch (error) {
            attempts.push(error.message);
            if (!/updated_at|created_at|organization_id|PGRST|column/i.test(error.message)) {
                throw error;
            }
        }
    }
    throw new Error(`Unable to query ${table}: ${attempts.join(" | ")}`);
}

async function fetchGeneratedImagesByIds({ supabaseUrl, supabaseKey, ids }) {
    const uniqueIds = Array.from(new Set(ids.map(clean).filter(Boolean)));
    if (uniqueIds.length === 0) return [];
    const headers = {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: "application/json",
    };
    const base = `${normalizeUrl(supabaseUrl)}/rest/v1/generated_images`;
    const rows = [];
    for (let i = 0; i < uniqueIds.length; i += 100) {
        const chunk = uniqueIds.slice(i, i + 100).map(postgrestValue).join(",");
        const url = `${base}?select=*&id=in.(${chunk})`;
        const data = await fetchJson(url, headers);
        if (Array.isArray(data)) rows.push(...data);
    }
    return rows;
}

function rowMatchesFamily(row, family) {
    if (!family) return true;
    const expected = family.toLowerCase();
    const familyValue = clean(row.family).toLowerCase();
    if (familyValue) return familyValue === expected;
    const slug =
        clean(row.product_group_slug) ||
        clean(row.convex_slug) ||
        clean(row.cohort_slug) ||
        clean(getPipelineSkuJobFromPublishLog(row).productGroupSlug) ||
        clean(getPipelineSkuJobFromPublishLog(row).product_group_slug);
    return slug.toLowerCase().startsWith(`${expected}-`);
}

function expectedFilenameStem(job) {
    const renderSku = canonicalRenderSku(job);
    const websiteSku = clean(job.website_sku);
    const slug = clean(job.product_group_slug);
    const mode =
        /cap[-_\s]?off/i.test(clean(job.expected_canonical_filename)) ||
        /cap[-_\s]?off/i.test(clean(job.best_reference_candidate_path))
            ? "cap-off"
            : "cap-on";
    return [renderSku, websiteSku && websiteSku !== renderSku ? websiteSku : "", mode, slug]
        .filter(Boolean)
        .join("__");
}

function textContainsAnyIdentity(text, identities) {
    const loose = compact(text);
    const slugText = slugifyLoose(text);
    return identities.some((identity) => {
        if (!identity) return false;
        return loose.includes(compact(identity)) || slugText.includes(slugifyLoose(identity));
    });
}

function skuIdentity(job) {
    return [
        clean(job.website_sku),
        clean(job.grace_sku),
        clean(job.shopify_sku),
    ].filter(Boolean);
}

function canonicalRenderSku(job) {
    return clean(job.grace_sku) || clean(job.shopify_sku) || clean(job.website_sku);
}

function groupIdentity(row) {
    return [
        clean(row.product_group_slug),
        clean(row.convex_slug),
        clean(row.cohort_slug),
    ].filter(Boolean);
}

function addIssue(issues, severity, table, id, identity, issue, detail = {}) {
    issues.push({ severity, table, id: clean(id), identity: clean(identity), issue, ...detail });
}

function auditSkuJob(job, generatedById, issues) {
    const identity = clean(job.website_sku) || clean(job.grace_sku) || clean(job.product_group_slug);
    const identities = [...skuIdentity(job), clean(job.product_group_slug)].filter(Boolean);

    if (!clean(job.website_sku)) {
        addIssue(issues, "high", "best_bottles_pipeline_sku_jobs", job.id, identity, "missing_website_sku");
    }
    if (!clean(job.grace_sku)) {
        addIssue(issues, "medium", "best_bottles_pipeline_sku_jobs", job.id, identity, "missing_grace_sku");
    }
    if (!clean(job.shopify_sku)) {
        addIssue(issues, "medium", "best_bottles_pipeline_sku_jobs", job.id, identity, "missing_shopify_sku_alias");
    }
    if (!clean(job.product_group_slug)) {
        addIssue(issues, "high", "best_bottles_pipeline_sku_jobs", job.id, identity, "missing_product_group_slug");
    }

    const expected = clean(job.expected_canonical_filename);
    const referencePath = clean(job.best_reference_candidate_path);
    if (!expected) {
        addIssue(issues, "medium", "best_bottles_pipeline_sku_jobs", job.id, identity, "missing_expected_canonical_filename", {
            recommended: expectedFilenameStem(job),
        });
    } else if (!textContainsAnyIdentity(expected, identities)) {
        addIssue(issues, "high", "best_bottles_pipeline_sku_jobs", job.id, identity, "expected_filename_lacks_sku_or_slug", {
            expected_canonical_filename: expected,
            recommended: expectedFilenameStem(job),
        });
    }

    if (referencePath && !textContainsAnyIdentity(urlBasename(referencePath), identities)) {
        addIssue(issues, "high", "best_bottles_pipeline_sku_jobs", job.id, identity, "reference_path_lacks_sku_or_slug", {
            best_reference_candidate_path: referencePath,
            file: urlBasename(referencePath),
            recommended: expected || expectedFilenameStem(job),
        });
    }

    for (const imageIdField of ["generated_image_id", "approved_image_id"]) {
        const imageId = clean(job[imageIdField]);
        if (!imageId) continue;
        const image = generatedById.get(imageId);
        if (!image) {
            addIssue(issues, "high", "best_bottles_pipeline_sku_jobs", job.id, identity, `${imageIdField}_not_found_in_generated_images`, {
                imageId,
            });
            continue;
        }
        const imageLabels = [
            image.session_name,
            image.description,
            image.variation_descriptor,
            urlBasename(image.image_url),
            ...(Array.isArray(image.library_tags) ? image.library_tags : []),
        ].map(clean).filter(Boolean);
        if (!imageLabels.some((label) => textContainsAnyIdentity(label, identities))) {
            addIssue(issues, "high", "generated_images", image.id, identity, "generated_image_label_lacks_sku_or_slug", {
                linkedFrom: `best_bottles_pipeline_sku_jobs.${imageIdField}`,
                labels: imageLabels.slice(0, 8),
                recommended: expected || expectedFilenameStem(job),
            });
        }
    }
}

function auditPipelineGroup(group, generatedById, issues) {
    const identity = clean(group.convex_slug) || clean(group.primary_website_sku) || group.id;
    const identities = [
        clean(group.convex_slug),
        clean(group.primary_website_sku),
        clean(group.primary_grace_sku),
    ].filter(Boolean);
    if (!clean(group.convex_slug)) {
        addIssue(issues, "high", "best_bottles_pipeline_groups", group.id, identity, "missing_convex_slug");
    }
    const imageId = clean(group.madison_approved_image_id);
    if (!imageId) return;
    const image = generatedById.get(imageId);
    if (!image) {
        addIssue(issues, "high", "best_bottles_pipeline_groups", group.id, identity, "madison_approved_image_id_not_found_in_generated_images", {
            imageId,
        });
        return;
    }
    const imageLabels = [
        image.session_name,
        image.description,
        image.variation_descriptor,
        urlBasename(image.image_url),
        ...(Array.isArray(image.library_tags) ? image.library_tags : []),
    ].map(clean).filter(Boolean);
    if (!imageLabels.some((label) => textContainsAnyIdentity(label, identities))) {
        addIssue(issues, "medium", "generated_images", image.id, identity, "approved_group_image_label_lacks_slug_or_primary_sku", {
            linkedFrom: "best_bottles_pipeline_groups.madison_approved_image_id",
            labels: imageLabels.slice(0, 8),
            recommended: `${clean(group.primary_website_sku) || clean(group.primary_grace_sku)}__hero__${clean(group.convex_slug)}`,
        });
    }
}

function auditApprovedAsset(asset, issues) {
    const identity = clean(asset.cohort_slug) || asset.id;
    const identities = [
        clean(asset.cohort_slug),
        clean(asset.family),
        clean(asset.glass_color),
        clean(asset.applicator),
        clean(asset.cap_color),
    ].filter(Boolean);
    if (!clean(asset.cohort_slug)) {
        addIssue(issues, "high", "paper_doll_approved_assets", asset.id, identity, "missing_cohort_slug");
    }
    for (const field of ["image_url", "source_image_url"]) {
        const url = clean(asset[field]);
        if (!url) continue;
        const file = urlBasename(url);
        if (!textContainsAnyIdentity(file, identities)) {
            addIssue(issues, "medium", "paper_doll_approved_assets", asset.id, identity, `${field}_filename_lacks_cohort_context`, {
                file,
                role: clean(asset.role),
                recommended: [
                    clean(asset.cohort_slug),
                    clean(asset.role),
                    clean(asset.body_variant),
                    clean(asset.applicator),
                    clean(asset.cap_color),
                ].filter(Boolean).join("__"),
            });
        }
    }
}

function auditPublishLog(row, skuJobBySku, issues) {
    const content = getPublishedContent(row);
    const pipelineSkuJob = getPipelineSkuJobFromPublishLog(row);
    const sku = clean(content.sku);
    const requestedWebsiteSku = clean(content.requestedWebsiteSku);
    const requestedGraceSku = clean(content.requestedGraceSku);
    const matchedShopifySku = clean(content.matchedShopifySku);
    const bestBottlesConvex = content.bestBottlesConvex && typeof content.bestBottlesConvex === "object"
        ? content.bestBottlesConvex
        : {};
    const convexWebsiteSku = clean(bestBottlesConvex.websiteSku);
    const identity = requestedWebsiteSku || convexWebsiteSku || sku || matchedShopifySku || row.id;

    const job =
        skuJobBySku.get(compact(requestedWebsiteSku)) ||
        skuJobBySku.get(compact(convexWebsiteSku)) ||
        skuJobBySku.get(compact(sku)) ||
        skuJobBySku.get(compact(matchedShopifySku)) ||
        skuJobBySku.get(compact(requestedGraceSku));
    if (!job) {
        addIssue(issues, "high", "shopify_publish_log", row.id, identity, "publish_log_sku_not_found_in_pipeline_sku_jobs", {
            sku,
            requestedWebsiteSku,
            requestedGraceSku,
            matchedShopifySku,
            convexWebsiteSku,
        });
        return;
    }

    if (requestedWebsiteSku && clean(job.website_sku) && compact(requestedWebsiteSku) !== compact(job.website_sku)) {
        addIssue(issues, "critical", "shopify_publish_log", row.id, identity, "requested_website_sku_disagrees_with_pipeline_job", {
            requestedWebsiteSku,
            pipelineWebsiteSku: clean(job.website_sku),
        });
    }
    if (pipelineSkuJob.websiteSku && clean(job.website_sku) && compact(pipelineSkuJob.websiteSku) !== compact(job.website_sku)) {
        addIssue(issues, "critical", "shopify_publish_log", row.id, identity, "logged_pipeline_job_website_sku_disagrees_with_current_job", {
            loggedWebsiteSku: pipelineSkuJob.websiteSku,
            pipelineWebsiteSku: clean(job.website_sku),
        });
    }
    if (convexWebsiteSku && clean(job.website_sku) && compact(convexWebsiteSku) !== compact(job.website_sku)) {
        addIssue(issues, "critical", "shopify_publish_log", row.id, identity, "convex_synced_website_sku_disagrees_with_pipeline_job", {
            convexWebsiteSku,
            pipelineWebsiteSku: clean(job.website_sku),
        });
    }
}

function walkFiles(dir, out = []) {
    for (const name of readdirSync(dir)) {
        if (name === ".DS_Store") continue;
        const path = resolve(dir, name);
        const stat = statSync(path);
        if (stat.isDirectory()) {
            walkFiles(path, out);
        } else {
            out.push(path);
        }
    }
    return out;
}

function isImageFile(path) {
    return [".png", ".jpg", ".jpeg", ".webp"].includes(extname(path).toLowerCase());
}

function fileMatchesFamily(filePath, root, family) {
    if (!family) return true;
    const rel = relative(root, filePath);
    const firstSegment = rel.split(/[\\/]/)[0] ?? "";
    return slugifyLoose(firstSegment) === slugifyLoose(family);
}

function compactStemMatchesSku(compactStem, skuKey) {
    if (!compactStem || !skuKey) return false;
    if (compactStem === skuKey) return true;
    if (!compactStem.startsWith(skuKey)) return false;
    const suffix = compactStem.slice(skuKey.length);
    // Accept upload/version suffixes such as _1779383449564 or -01 only
    // when they are numeric. Do not let MSLV match MSLV-T.
    return /^\d+$/.test(suffix);
}

function auditLocalFolder(folder, family, skuJobBySku, issues) {
    if (!folder) return null;
    const root = resolve(folder);
    if (!existsSync(root)) {
        addIssue(issues, "high", "local_render_folder", root, root, "local_render_folder_not_found");
        return { files: 0, imageFiles: 0, matched: 0, unmatched: 0, duplicateStems: 0 };
    }

    const allFiles = walkFiles(root);
    const imageFiles = allFiles.filter((file) => isImageFile(file) && fileMatchesFamily(file, root, family));
    const seen = new Map();
    let matched = 0;
    let unmatched = 0;

    for (const file of imageFiles) {
        const rel = relative(root, file);
        const stem = basename(file, extname(file));
        const compactStem = compact(stem);
        const matches = [];
        for (const [skuKey, job] of skuJobBySku.entries()) {
            if (compactStemMatchesSku(compactStem, skuKey)) matches.push(job);
        }

        if (matches.length === 0) {
            unmatched += 1;
            addIssue(issues, "high", "local_render_folder", rel, stem, "local_file_name_does_not_match_any_pipeline_sku", {
                file: rel,
            });
            continue;
        }

        matched += 1;
        const uniqueJobIds = Array.from(new Set(matches.map((job) => job.id)));
        if (uniqueJobIds.length > 1) {
            addIssue(issues, "high", "local_render_folder", rel, stem, "local_file_name_matches_multiple_pipeline_skus", {
                file: rel,
                matchedJobs: uniqueJobIds.slice(0, 8),
            });
        }

        const job = matches[0];
        const renderSku = canonicalRenderSku(job);
        if (renderSku && !compactStem.includes(compact(renderSku))) {
            addIssue(issues, "medium", "local_render_folder", rel, stem, "local_file_uses_alias_not_render_sku", {
                file: rel,
                renderSku,
                websiteSku: clean(job.website_sku),
                graceSku: clean(job.grace_sku),
                shopifySku: clean(job.shopify_sku),
                recommended: `${renderSku}${extname(file).toLowerCase()}`,
            });
        }

        const previous = seen.get(compactStem) ?? [];
        previous.push(rel);
        seen.set(compactStem, previous);
    }

    let duplicateStems = 0;
    for (const [stem, files] of seen.entries()) {
        if (files.length <= 1) continue;
        duplicateStems += 1;
        addIssue(issues, "medium", "local_render_folder", stem, stem, "duplicate_local_render_filename_stem", {
            files: files.slice(0, 10),
        });
    }

    return {
        files: allFiles.length,
        imageFiles: imageFiles.length,
        matched,
        unmatched,
        duplicateStems,
    };
}

function printReport(report) {
    if (report.options.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
    }

    console.log("Madison Image Naming Consistency Audit");
    console.log("──────────────────────────────────────");
    console.log(`Supabase: ${report.supabase.projectUrl}`);
    console.log(`Organization: ${report.options.orgId}`);
    console.log(`Family filter: ${report.options.family ?? "ALL"}`);
    console.log("");
    console.log(`Pipeline SKU jobs audited: ${report.counts.pipelineSkuJobs}`);
    console.log(`Pipeline groups audited: ${report.counts.pipelineGroups}`);
    console.log(`Approved paper-doll assets audited: ${report.counts.approvedAssets}`);
    console.log(`Shopify publish logs audited: ${report.counts.publishLogs}`);
    console.log(`Generated images resolved: ${report.counts.generatedImagesResolved}`);
    if (report.counts.localFolder) {
        console.log(`Local render folder image files audited: ${report.counts.localFolder.imageFiles}`);
        console.log(`Local render folder matched files: ${report.counts.localFolder.matched}`);
        console.log(`Local render folder unmatched files: ${report.counts.localFolder.unmatched}`);
    }
    console.log("");
    console.log("Issues by severity");
    for (const severity of ["critical", "high", "medium", "low"]) {
        console.log(`  ${severity}: ${report.counts.bySeverity[severity] ?? 0}`);
    }
    console.log("");
    console.log("Issues by type");
    for (const [issue, count] of Object.entries(report.counts.byIssue)) {
        console.log(`  ${issue}: ${count}`);
    }
    if (Object.keys(report.counts.byIssue).length === 0) console.log("  None detected.");

    if (report.samples.length) {
        console.log("");
        console.log("Sample issues");
        for (const issue of report.samples.slice(0, 15)) {
            console.log(`  [${issue.severity}] ${issue.table}:${issue.id || "(no id)"} ${issue.identity} → ${issue.issue}`);
            if (issue.recommended) console.log(`    recommended: ${issue.recommended}`);
        }
    }

    console.log("");
    console.log("Read-only audit complete. No Madison/Supabase, Shopify, Sanity, or Convex writes were performed.");
}

async function main() {
    const initial = parseArgs();
    loadEnvironment(initial.madisonRepo);
    const options = parseArgs();
    if (!options.supabaseUrl || !options.supabaseKey) {
        console.error("Missing Supabase connection. Use Madison .env or pass --supabase-url and --supabase-key.");
        process.exit(1);
    }

    const [skuJobsRaw, groupsRaw, assetsRaw, publishLogsRaw] = await Promise.all([
        fetchTable({ ...options, table: "best_bottles_pipeline_sku_jobs" }),
        fetchTable({ ...options, table: "best_bottles_pipeline_groups" }),
        fetchTable({ ...options, table: "paper_doll_approved_assets" }),
        fetchTable({ ...options, table: "shopify_publish_log" }),
    ]);

    const skuJobs = skuJobsRaw.filter((row) => rowMatchesFamily(row, options.family));
    const groups = groupsRaw.filter((row) => rowMatchesFamily(row, options.family));
    const assets = assetsRaw.filter((row) => rowMatchesFamily(row, options.family));
    const publishLogs = publishLogsRaw.filter((row) => rowMatchesFamily(row, options.family));

    const imageIds = [
        ...skuJobs.flatMap((job) => [job.generated_image_id, job.approved_image_id]),
        ...groups.map((group) => group.madison_approved_image_id),
        ...assets.map((asset) => asset.library_image_id),
    ].map(clean).filter(Boolean);
    const generatedImages = await fetchGeneratedImagesByIds({ ...options, ids: imageIds });
    const generatedById = new Map(generatedImages.map((image) => [image.id, image]));

    const skuJobBySku = new Map();
    for (const job of skuJobs) {
        for (const sku of [job.website_sku, job.grace_sku, job.shopify_sku].map(clean).filter(Boolean)) {
            skuJobBySku.set(compact(sku), job);
        }
    }

    const issues = [];
    for (const job of skuJobs) auditSkuJob(job, generatedById, issues);
    for (const group of groups) auditPipelineGroup(group, generatedById, issues);
    for (const asset of assets) auditApprovedAsset(asset, issues);
    for (const log of publishLogs) auditPublishLog(log, skuJobBySku, issues);
    const localFolder = auditLocalFolder(options.folder, options.family, skuJobBySku, issues);

    const bySeverity = {};
    const byIssue = {};
    for (const issue of issues) {
        bySeverity[issue.severity] = (bySeverity[issue.severity] ?? 0) + 1;
        byIssue[issue.issue] = (byIssue[issue.issue] ?? 0) + 1;
    }

    printReport({
        supabase: {
            projectUrl: normalizeUrl(options.supabaseUrl),
            keyType: process.env.SUPABASE_SERVICE_ROLE_KEY ? "service_role_or_supplied" : "publishable_or_anon",
        },
        options: {
            ...options,
            supabaseKey: "[redacted]",
        },
        counts: {
            pipelineSkuJobs: skuJobs.length,
            pipelineGroups: groups.length,
            approvedAssets: assets.length,
            publishLogs: publishLogs.length,
            generatedImagesResolved: generatedImages.length,
            localFolder,
            bySeverity,
            byIssue,
        },
        samples: issues.slice(0, 50),
    });
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
