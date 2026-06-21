import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const RENDERED_UI_AUDIT_HEADERS = [
    "surface",
    "staging_url",
    "family",
    "product_group_slug",
    "graceSku",
    "websiteSku",
    "shopify_variant_id",
    "rendered_image_url",
    "image_classification",
    "needs_generation_or_fix",
    "generation_bucket",
    "reference_source",
    "reference_url_or_path",
    "existing_madison_evidence_url",
    "next_action",
    "qa_status",
    "notes",
];

export function clean(value) {
    return typeof value === "string" ? value.trim() : "";
}

export function skuKey(value) {
    return clean(value).replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function slugKey(value) {
    return clean(value).toLowerCase();
}

function urlHost(value) {
    try {
        return new URL(value).hostname.toLowerCase();
    } catch {
        return "";
    }
}

function urlPath(value) {
    try {
        return new URL(value).pathname.toLowerCase();
    } catch {
        return clean(value).toLowerCase();
    }
}

export function isLegacyBestBottlesImageUrl(value) {
    const url = clean(value);
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return parsed.hostname === "www.bestbottles.com" && parsed.pathname.startsWith("/images/store/");
    } catch {
        return /www\.bestbottles\.com\/images\/store\//i.test(url);
    }
}

export function isReferenceImportUrl(value) {
    const haystack = `${urlHost(value)} ${urlPath(value)} ${clean(value)}`.toLowerCase();
    return /reference[-_/ ]imports?|legacy[-_/ ]reference|bestbottles[-_/ ]live|source[-_/ ]reference/.test(haystack);
}

export function isMadisonGeneratedUrl(value) {
    const host = urlHost(value);
    const path = urlPath(value);
    if (isReferenceImportUrl(value)) return false;
    if (host === "cdn.shopify.com") return false;
    return (
        host.includes("supabase.co") ||
        host.includes("supabase.in") ||
        /\/generated-images\/.*\/(?:local-generation|paper-doll|approved|cap-on|generated)\//i.test(path) ||
        /madison|master_corrected|local-generation|paper-doll|approved/i.test(path)
    );
}

function evidenceBucket(evidence) {
    return clean(evidence?.generationBucket || evidence?.actionBucket);
}

function evidenceReferenceSource(evidence) {
    return clean(evidence?.referenceSource || evidence?.reference_source);
}

/**
 * @param {{ renderedImageUrl?: string | null, auditEvidence?: Record<string, any> | null }} input
 */
export function classifyRenderedImage({ renderedImageUrl, auditEvidence = null }) {
    const url = clean(renderedImageUrl);
    const bucket = evidenceBucket(auditEvidence);
    const referenceSource = evidenceReferenceSource(auditEvidence);
    const hasAuditFlag = Boolean(auditEvidence?.isReferenceAuditFlag);

    let imageClassification = "shopify_cdn_unknown";
    let urlIsReferenceLike = false;

    if (!url) {
        imageClassification = "no_image";
    } else if (isLegacyBestBottlesImageUrl(url)) {
        imageClassification = "legacy_bestbottles_url";
        urlIsReferenceLike = true;
    } else if (isReferenceImportUrl(url)) {
        imageClassification = "reference_import";
        urlIsReferenceLike = true;
    } else if (/bestbottles\.com/i.test(url)) {
        imageClassification = "legacy_site_reference";
        urlIsReferenceLike = true;
    } else if (bucket === "blocked_truth_review" || referenceSource === "blocked") {
        imageClassification = "blocked_truth_review";
    } else if (isMadisonGeneratedUrl(url)) {
        imageClassification = "madison_generated";
    } else if (urlHost(url) === "cdn.shopify.com") {
        imageClassification = "shopify_cdn_unknown";
    }

    return {
        imageClassification,
        needsGenerationOrFix: urlIsReferenceLike || hasAuditFlag || imageClassification === "blocked_truth_review",
    };
}

function parseCsvLine(line) {
    const cells = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"') {
            if (quoted && line[i + 1] === '"') {
                cell += '"';
                i += 1;
            } else {
                quoted = !quoted;
            }
        } else if (char === "," && !quoted) {
            cells.push(cell);
            cell = "";
        } else {
            cell += char;
        }
    }
    cells.push(cell);
    return cells;
}

export function parseCsv(text) {
    const lines = String(text || "").split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (!lines.length) return [];
    const headers = parseCsvLine(lines[0]).map(clean);
    return lines.slice(1).map((line) => {
        const cells = parseCsvLine(line);
        return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    });
}

export function readCsvIfExists(path) {
    if (!existsSync(path)) return [];
    return parseCsv(readFileSync(path, "utf8"));
}

function addEvidence(index, row, evidence) {
    const keys = [
        row.graceSku,
        row.grace_sku,
        row.sku,
        row.websiteSku,
        row.website_sku,
        row.shopifySku,
        row.shopify_sku,
    ].map(skuKey).filter(Boolean);
    for (const key of keys) {
        if (!index.bySku.has(key)) index.bySku.set(key, []);
        index.bySku.get(key).push(evidence);
    }

    const slug = slugKey(row.product_group_slug || row.productGroupSlug || row.identity);
    if (slug) {
        if (!index.byProductGroupSlug.has(slug)) index.byProductGroupSlug.set(slug, []);
        index.byProductGroupSlug.get(slug).push(evidence);
    }
}

function buildEvidenceIndex({ legacyReferenceRows = [], suspiciousSyncedRows = [], reconciliationRows = [], skuTruthRows = [] }) {
    const index = {
        bySku: new Map(),
        byProductGroupSlug: new Map(),
    };

    for (const row of legacyReferenceRows) {
        addEvidence(index, row, {
            source: "legacy_reference_image_still_showing",
            isReferenceAuditFlag: true,
            family: clean(row.family),
            productGroupSlug: clean(row.product_group_slug),
            graceSku: clean(row.sku),
            websiteSku: clean(row.website_sku),
            shopifyVariantId: clean(row.shopify_variant_id),
            generationBucket: clean(row.generation_bucket),
            referenceSource: clean(row.reference_source),
            referenceUrlOrPath: clean(row.reference_url || row.convex_image_url || row.shopify_image_url),
            existingMadisonEvidenceUrl: clean(row.madison_evidence_url),
            nextAction: clean(row.recommended_next_action),
            issue: clean(row.issue),
        });
    }

    for (const row of suspiciousSyncedRows) {
        addEvidence(index, row, {
            source: "suspicious_synced_reference_rows",
            isReferenceAuditFlag: true,
            family: "",
            productGroupSlug: clean(row.identity),
            graceSku: "",
            websiteSku: "",
            shopifyVariantId: "",
            generationBucket: "blocked_truth_review",
            referenceSource: "legacy_reference_field",
            referenceUrlOrPath: clean(row.reference_url),
            existingMadisonEvidenceUrl: "",
            nextAction: clean(row.recommended_next_action),
            issue: clean(row.issue),
        });
    }

    for (const row of reconciliationRows) {
        addEvidence(index, row, {
            source: "launch_image_reconciliation_manifest",
            isReferenceAuditFlag: false,
            family: clean(row.family),
            productGroupSlug: clean(row.product_group_slug),
            graceSku: clean(row.graceSku),
            websiteSku: clean(row.websiteSku),
            shopifyVariantId: clean(row.shopify_variant_id),
            actionBucket: clean(row.action_bucket),
            referenceSource: clean(row.reference_source),
            referenceUrlOrPath: clean(row.reference_url_or_path),
            existingMadisonEvidenceUrl: clean(row.generated_image_path_or_shopify_cdn_url),
            nextAction: clean(row.recommended_next_action),
            issue: clean(row.issue),
        });
    }

    for (const row of skuTruthRows) {
        if (clean(row.legacyReferenceInConvex).toLowerCase() !== "yes") continue;
        addEvidence(index, row, {
            source: "sku_image_truth_rollup",
            isReferenceAuditFlag: true,
            family: clean(row.family),
            productGroupSlug: clean(row.productGroupSlug),
            graceSku: clean(row.graceSku),
            websiteSku: clean(row.websiteSku),
            shopifyVariantId: "",
            generationBucket: clean(row.hasMadisonGeneratedEvidence).toLowerCase() === "yes"
                ? "covered_madison_not_synced"
                : "generate_from_legacy_reference",
            referenceSource: "legacy_reference_in_convex",
            referenceUrlOrPath: clean(row.currentImageUrl || row.currentImageUrlCapOff),
            existingMadisonEvidenceUrl: clean(row.madisonEvidenceUrlSample).split(";")[0],
            nextAction: "Replace legacy/reference Convex image by Grace SKU after product truth review.",
            issue: "legacy_reference_in_convex",
        });
    }

    return index;
}

function evidenceForRenderedImage(row, index) {
    for (const key of [row.graceSku, row.grace_sku, row.sku].map(skuKey).filter(Boolean)) {
        const matches = index.bySku.get(key);
        if (matches?.length) return matches[0];
    }
    const slugMatches = index.byProductGroupSlug.get(slugKey(row.productGroupSlug || row.product_group_slug));
    if (slugMatches?.length) return slugMatches[0];
    for (const key of [row.websiteSku, row.website_sku, row.shopifySku, row.shopify_sku].map(skuKey).filter(Boolean)) {
        const matches = index.bySku.get(key);
        if (matches?.length) return matches[0];
    }
    return null;
}

function qaStatusFor({ flagged, generationBucket }) {
    if (!flagged) return "pass";
    if (generationBucket === "blocked_truth_review") return "blocked_truth_review";
    if (generationBucket === "covered_madison_not_synced" || generationBucket === "assign_existing_media") {
        return "needs_sync_or_push";
    }
    return "needs_generation";
}

function fallbackGenerationBucket(classification) {
    if (classification === "reference_import") return "generate_from_local_reference";
    if (classification === "legacy_bestbottles_url" || classification === "legacy_site_reference") return "generate_from_legacy_reference";
    if (classification === "blocked_truth_review") return "blocked_truth_review";
    return "";
}

function buildAuditRow(rendered, evidence, classification) {
    const generationBucket = evidenceBucket(evidence) || fallbackGenerationBucket(classification.imageClassification);
    const flagged = classification.needsGenerationOrFix;
    const referenceUrlOrPath = clean(evidence?.referenceUrlOrPath) || (flagged ? clean(rendered.renderedImageUrl) : "");
    return {
        surface: clean(rendered.surface),
        stagingUrl: clean(rendered.stagingUrl || rendered.staging_url),
        family: clean(rendered.family) || clean(evidence?.family),
        productGroupSlug: clean(rendered.productGroupSlug || rendered.product_group_slug) || clean(evidence?.productGroupSlug),
        graceSku: clean(rendered.graceSku || rendered.grace_sku || rendered.sku) || clean(evidence?.graceSku),
        websiteSku: clean(rendered.websiteSku || rendered.website_sku) || clean(evidence?.websiteSku),
        shopifyVariantId: clean(rendered.shopifyVariantId || rendered.shopify_variant_id) || clean(evidence?.shopifyVariantId),
        renderedImageUrl: clean(rendered.renderedImageUrl || rendered.rendered_image_url),
        imageClassification: classification.imageClassification,
        needsGenerationOrFix: flagged ? "yes" : "no",
        generationBucket,
        referenceSource: clean(evidence?.referenceSource) || (flagged ? classification.imageClassification : ""),
        referenceUrlOrPath,
        existingMadisonEvidenceUrl: clean(evidence?.existingMadisonEvidenceUrl),
        nextAction: clean(evidence?.nextAction) || (flagged ? "Verify product truth, generate or sync by graceSku, then rerun the staging UI audit." : ""),
        qaStatus: qaStatusFor({ flagged, generationBucket }),
        notes: [clean(evidence?.source), clean(evidence?.issue)].filter(Boolean).join(" | "),
    };
}

function increment(object, key, amount = 1) {
    const normalized = clean(key) || "Unknown";
    object[normalized] = (object[normalized] ?? 0) + amount;
}

function summarize(rows) {
    const flagged = rows.filter((row) => row.needsGenerationOrFix === "yes");
    const generationBuckets = new Set(["generate_from_local_reference", "generate_from_legacy_reference"]);
    const syncBuckets = new Set(["covered_madison_not_synced", "assign_existing_media"]);
    const summary = {
        renderedImagesChecked: rows.length,
        flaggedRows: flagged.length,
        rowsNeedingGeneration: flagged.filter((row) => generationBuckets.has(row.generationBucket)).length,
        rowsNeedingSyncOrPush: flagged.filter((row) => syncBuckets.has(row.generationBucket)).length,
        blockedTruthReviewRows: flagged.filter((row) => row.generationBucket === "blocked_truth_review").length,
        byFamily: {},
        byGenerationBucket: {},
        byImageClassification: {},
    };
    for (const row of flagged) {
        increment(summary.byFamily, row.family);
        increment(summary.byGenerationBucket, row.generationBucket || "unbucketed");
    }
    for (const row of rows) {
        increment(summary.byImageClassification, row.imageClassification);
    }
    return summary;
}

/**
 * @param {{
 *   generatedAt?: string,
 *   baseUrl?: string,
 *   renderedImages?: Array<Record<string, any>>,
 *   legacyReferenceRows?: Array<Record<string, any>>,
 *   suspiciousSyncedRows?: Array<Record<string, any>>,
 *   reconciliationRows?: Array<Record<string, any>>,
 *   skuTruthRows?: Array<Record<string, any>>,
 * }} input
 */
export function buildRenderedUiAudit({
    generatedAt = new Date().toISOString(),
    baseUrl = "http://localhost:3000",
    renderedImages = [],
    legacyReferenceRows = [],
    suspiciousSyncedRows = [],
    reconciliationRows = [],
    skuTruthRows = [],
}) {
    const evidenceIndex = buildEvidenceIndex({
        legacyReferenceRows,
        suspiciousSyncedRows,
        reconciliationRows,
        skuTruthRows,
    });
    const rows = renderedImages.map((rendered) => {
        const evidence = evidenceForRenderedImage(rendered, evidenceIndex);
        const classification = classifyRenderedImage({
            renderedImageUrl: rendered.renderedImageUrl || rendered.rendered_image_url,
            auditEvidence: evidence,
        });
        return buildAuditRow(rendered, evidence, classification);
    });
    return {
        generatedAt,
        source: "audit_staging_ui_reference_images.mjs",
        baseUrl,
        rule: "Flag rendered product images only when URL/provenance is legacy or reference-backed, or when June 15 audit evidence already identifies the row as reference risk.",
        summary: summarize(rows),
        rows,
    };
}

function csvEscape(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function writeCsv(path, rows, headers = RENDERED_UI_AUDIT_HEADERS) {
    mkdirSync(dirname(path), { recursive: true });
    const csv = [
        headers.map(csvEscape).join(","),
        ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
    ].join("\n") + "\n";
    writeFileSync(path, csv);
}

function renderSummaryMarkdown(audit, paths) {
    return [
        "# Best Bottles Staging UI Legacy/Reference Image Audit",
        "",
        `Generated: ${audit.generatedAt}`,
        `Base URL: ${audit.baseUrl}`,
        "",
        "## Counts",
        "",
        `- Rendered images checked: ${audit.summary.renderedImagesChecked}`,
        `- Flagged rows: ${audit.summary.flaggedRows}`,
        `- Rows needing generation: ${audit.summary.rowsNeedingGeneration}`,
        `- Rows needing sync or push: ${audit.summary.rowsNeedingSyncOrPush}`,
        `- Blocked truth review rows: ${audit.summary.blockedTruthReviewRows}`,
        "",
        "## Artifacts",
        "",
        `- JSON: ${paths.jsonPath}`,
        `- CSV: ${paths.csvPath}`,
        "",
    ].join("\n");
}

export function writeRenderedUiAuditArtifacts({ audit, outDir }) {
    mkdirSync(outDir, { recursive: true });
    const jsonPath = resolve(outDir, "staging_ui_reference_render_audit.json");
    const csvPath = resolve(outDir, "staging_ui_reference_render_audit.csv");
    const summaryPath = resolve(outDir, "staging_ui_reference_render_audit.md");
    writeFileSync(jsonPath, JSON.stringify(audit, null, 2));
    writeCsv(csvPath, audit.rows);
    writeFileSync(summaryPath, renderSummaryMarkdown(audit, { jsonPath, csvPath }));
    return { jsonPath, csvPath, summaryPath };
}
