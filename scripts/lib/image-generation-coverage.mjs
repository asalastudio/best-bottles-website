import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, relative, resolve } from "node:path";

export const PIPELINE_LANE_ID = "grid-card-2000x2200";

const IMAGE_EXTENSIONS = new Set([".gif", ".jpg", ".jpeg", ".png", ".webp"]);

export const DEFAULT_LOCAL_REFERENCE_DIRS = [
    "pipeline/madison-hero-sync/renders/madison-masters-2080x2288-all-families-2026-05-08",
    "pipeline/aios-shopify-pdp-images/00-input/reference-flattened",
    "pipeline/paper-doll/reference-images",
    "pipeline/aios-shopify-pdp-images/00-input/legacy-reference",
    "pipeline/image-gen/grid-images/approved",
    "pipeline/image-gen/grid-images/reference",
    "pipeline/image-gen/grid-images/output",
];

export function clean(value) {
    return typeof value === "string" ? value.trim() : "";
}

export function compactSku(value) {
    return clean(value).replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function normalizeUrl(value) {
    return clean(value).replace(/\/+$/, "");
}

function urlHost(value) {
    try {
        return new URL(value).hostname.toLowerCase();
    } catch {
        return "";
    }
}

function isHttpImageUrl(value) {
    const url = clean(value);
    return /^https?:\/\//i.test(url) &&
        (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(url) ||
            /cdn\.shopify|bestbottles\.com\/images|storage\/v1\/object|supabase|madison/i.test(url));
}

export function isShopifyCdnImageUrl(value) {
    return urlHost(value) === "cdn.shopify.com";
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

export function isMadisonGeneratedImageUrl(value) {
    const host = urlHost(value);
    return host.includes("supabase.co") ||
        host.includes("supabase.in") ||
        host.includes("storage.googleapis.com") ||
        /generated|madison|paper[_-]?doll|approved/i.test(clean(value));
}

function productSkuKeys(product) {
    return Array.from(new Set([
        product?.graceSku,
        product?.grace_sku,
        product?.websiteSku,
        product?.website_sku,
        product?.shopifySku,
        product?.shopify_sku,
        product?.sku,
    ].map(clean).filter(Boolean)));
}

function firstBySku(product, map) {
    for (const key of productSkuKeys(product)) {
        const rows = map.get(key) || map.get(compactSku(key));
        if (rows?.length) return rows;
    }
    return [];
}

function productImageUrls(product) {
    return [
        product?.imageUrl,
        product?.image_url,
        product?.imageUrlCapOff,
        product?.image_url_cap_off,
        product?.heroImageUrl,
        product?.hero_image_url,
    ].map(clean).filter(Boolean);
}

function bestLegacyReferenceUrl(product) {
    return productImageUrls(product).find(isLegacyBestBottlesImageUrl) || "";
}

function bestTrustedProductImageUrl(product) {
    return productImageUrls(product).find((url) => isShopifyCdnImageUrl(url) || isMadisonGeneratedImageUrl(url)) || "";
}

function bestProductUrl(product) {
    return clean(product?.productUrl) || clean(product?.product_url) || "";
}

export function productGroupSlug(product) {
    return clean(product?.productGroupSlug) ||
        clean(product?.product_group_slug) ||
        clean(product?.slug) ||
        clean(product?.groupSlug) ||
        clean(product?.group_slug);
}

function materialBucket(product) {
    const color = clean(product?.color).toLowerCase();
    const family = clean(product?.family).toLowerCase();
    const sku = clean(product?.graceSku || product?.grace_sku).toUpperCase();
    if (color.includes("frost") || sku.includes("-FRS-")) return "frosted";
    if (color.includes("clear") || sku.includes("-CLR-")) return "clear";
    if (color.includes("amber") || sku.includes("-AMB-")) return "amber";
    if (color.includes("cobalt") || color.includes("blue") || sku.includes("-BLU-")) return "cobalt-blue";
    if (color.includes("black") || sku.includes("-BLK-")) return "black";
    if (family.includes("aluminum") || sku.startsWith("AB-")) return "metal";
    if (family.includes("plastic") || sku.startsWith("PB-")) return "plastic";
    return color || "unknown";
}

function promptMissingFields(product) {
    const required = ["applicator", "capStyle", "capColor", "heightWithoutCap", "heightWithCap", "diameter"];
    return required.filter((field) => clean(product?.[field]) === "" && product?.[field] !== 0);
}

function baseAuditRow(product) {
    return {
        productId: clean(product?.productId) || clean(product?._id),
        graceSku: clean(product?.graceSku || product?.grace_sku),
        websiteSku: clean(product?.websiteSku || product?.website_sku),
        family: clean(product?.family),
        productGroupSlug: productGroupSlug(product),
        itemName: clean(product?.itemName),
        color: clean(product?.color),
        capacity: clean(product?.capacity),
        capacityMl: product?.capacityMl ?? product?.capacity_ml ?? "",
        applicator: clean(product?.applicator),
        capStyle: clean(product?.capStyle),
        capColor: clean(product?.capColor),
        materialBucket: materialBucket(product),
        currentImageUrl: clean(product?.imageUrl || product?.image_url),
        currentImageUrlCapOff: clean(product?.imageUrlCapOff || product?.image_url_cap_off),
        productUrl: bestProductUrl(product),
        missingPromptFields: promptMissingFields(product).join(";"),
    };
}

export function classifyCatalogImageRow({ product, localReferencesBySku, madisonEvidenceBySku }) {
    const base = baseAuditRow(product);
    const trustedImageUrl = bestTrustedProductImageUrl(product);
    if (trustedImageUrl) {
        return {
            ...base,
            coverageStatus: "covered",
            coverageSource: isShopifyCdnImageUrl(trustedImageUrl) ? "convex_shopify_cdn" : "convex_generated_media",
            generationBucket: "covered_existing_media",
            referenceStatus: "not_needed",
            referenceSource: "",
            referencePath: "",
            referenceUrl: "",
            coverageEvidenceUrl: trustedImageUrl,
        };
    }

    const madisonEvidence = firstBySku(product, madisonEvidenceBySku);
    if (madisonEvidence.length) {
        return {
            ...base,
            coverageStatus: "covered",
            coverageSource: "madison_generated_evidence",
            generationBucket: "covered_madison_not_synced",
            referenceStatus: "not_needed",
            referenceSource: madisonEvidence[0]?.source ?? "madison",
            referencePath: "",
            referenceUrl: "",
            coverageEvidenceUrl: madisonEvidence[0]?.imageUrls?.[0] ?? "",
            madisonEvidenceCount: madisonEvidence.length,
        };
    }

    const localReferences = firstBySku(product, localReferencesBySku);
    if (localReferences.length) {
        return {
            ...base,
            coverageStatus: "needs_generation",
            coverageSource: "none",
            generationBucket: "generate_from_local_reference",
            referenceStatus: "local_reference_ready",
            referenceSource: localReferences[0].source,
            referencePath: localReferences[0].path,
            referenceUrl: "",
            coverageEvidenceUrl: "",
            localReferenceCount: localReferences.length,
        };
    }

    const legacyReferenceUrl = bestLegacyReferenceUrl(product);
    if (legacyReferenceUrl) {
        return {
            ...base,
            coverageStatus: "needs_generation",
            coverageSource: "none",
            generationBucket: "generate_from_legacy_reference",
            referenceStatus: "legacy_reference_ready",
            referenceSource: "legacy_bestbottles_image_url",
            referencePath: "",
            referenceUrl: legacyReferenceUrl,
            coverageEvidenceUrl: "",
        };
    }

    const productUrl = bestProductUrl(product);
    if (/bestbottles\.com\/product\//i.test(productUrl)) {
        return {
            ...base,
            coverageStatus: "needs_generation",
            coverageSource: "none",
            generationBucket: "legacy_site_lookup_needed",
            referenceStatus: "legacy_site_lookup_needed",
            referenceSource: "legacy_bestbottles_product_page",
            referencePath: "",
            referenceUrl: productUrl,
            coverageEvidenceUrl: "",
        };
    }

    return {
        ...base,
        coverageStatus: "needs_generation",
        coverageSource: "none",
        generationBucket: "manual_reference_needed",
        referenceStatus: "manual_reference_needed",
        referenceSource: "",
        referencePath: "",
        referenceUrl: "",
        coverageEvidenceUrl: "",
    };
}

function increment(target, key, amount = 1) {
    target[key] = (target[key] ?? 0) + amount;
}

function summarizeRows(rows) {
    const summary = {
        totalProducts: rows.length,
        coveredExistingMedia: rows.filter((row) => row.generationBucket === "covered_existing_media").length,
        coveredMadisonNotSynced: rows.filter((row) => row.generationBucket === "covered_madison_not_synced").length,
        needsGeneration: rows.filter((row) => row.coverageStatus === "needs_generation").length,
        generateFromLocalReference: rows.filter((row) => row.generationBucket === "generate_from_local_reference").length,
        generateFromLegacyReference: rows.filter((row) => row.generationBucket === "generate_from_legacy_reference").length,
        legacySiteLookupNeeded: rows.filter((row) => row.generationBucket === "legacy_site_lookup_needed").length,
        manualReferenceNeeded: rows.filter((row) => row.generationBucket === "manual_reference_needed").length,
        promptIncompleteRows: rows.filter((row) => row.missingPromptFields).length,
        byFamily: {},
        byGenerationBucket: {},
        byMaterialBucket: {},
    };
    for (const row of rows) {
        const family = row.family || "Unknown";
        summary.byFamily[family] ||= { total: 0, covered: 0, needsGeneration: 0, localReference: 0, legacyReference: 0, lookupNeeded: 0, manualReference: 0 };
        summary.byFamily[family].total += 1;
        if (row.coverageStatus === "covered") summary.byFamily[family].covered += 1;
        if (row.coverageStatus === "needs_generation") summary.byFamily[family].needsGeneration += 1;
        if (row.generationBucket === "generate_from_local_reference") summary.byFamily[family].localReference += 1;
        if (row.generationBucket === "generate_from_legacy_reference") summary.byFamily[family].legacyReference += 1;
        if (row.generationBucket === "legacy_site_lookup_needed") summary.byFamily[family].lookupNeeded += 1;
        if (row.generationBucket === "manual_reference_needed") summary.byFamily[family].manualReference += 1;
        increment(summary.byGenerationBucket, row.generationBucket);
        increment(summary.byMaterialBucket, row.materialBucket || "unknown");
    }
    return summary;
}

export function buildImageGenerationAudit({ products, localReferencesBySku, madisonEvidenceBySku, generatedAt = new Date().toISOString() }) {
    const rows = products
        .filter((product) => clean(product?.graceSku || product?.grace_sku))
        .map((product) => classifyCatalogImageRow({ product, localReferencesBySku, madisonEvidenceBySku }));
    return {
        generatedAt,
        mode: "read-only",
        coverageRule: "Shopify CDN or Madison/Supabase generated evidence counts as image coverage; legacy bestbottles.com media counts only as reference evidence.",
        summary: summarizeRows(rows),
        rows,
    };
}

function isImageFile(filePath) {
    return IMAGE_EXTENSIONS.has(extname(filePath).toLowerCase());
}

export function listImageFiles(rootPath) {
    if (!existsSync(rootPath)) return [];
    const files = [];
    const stack = [rootPath];
    while (stack.length) {
        const current = stack.pop();
        let stats;
        try {
            stats = statSync(current);
        } catch {
            continue;
        }
        if (stats.isDirectory()) {
            for (const entry of readdirSync(current)) stack.push(resolve(current, entry));
        } else if (stats.isFile() && isImageFile(current)) {
            files.push(current);
        }
    }
    return files;
}

export function scanLocalReferenceImages({ root, sourceDirs = DEFAULT_LOCAL_REFERENCE_DIRS }) {
    const records = [];
    for (const sourceDir of sourceDirs) {
        const absoluteRoot = resolve(root, sourceDir);
        for (const path of listImageFiles(absoluteRoot)) {
            records.push({
                source: sourceDir.split("/").at(-1) || sourceDir,
                sourceDir,
                path,
                relativePath: relative(root, path),
                compactPath: compactSku(relative(root, path)),
                compactName: compactSku(basename(path, extname(path))),
            });
        }
    }
    return records;
}

export function buildLocalReferencesBySku({ products, localImages }) {
    const bySku = new Map();
    const compactToSkus = buildCompactSkuIndex(products);
    const skuRegex = buildSkuRegex(compactToSkus.keys());
    if (!skuRegex) return bySku;

    const addMatch = (sku, image) => {
        const compact = compactSku(sku);
        if (!bySku.has(sku)) bySku.set(sku, []);
        if (!bySku.has(compact)) bySku.set(compact, []);
        const match = {
            source: image.source,
            sourceDir: image.sourceDir,
            path: image.path,
            relativePath: image.relativePath,
        };
        bySku.get(sku).push(match);
        bySku.get(compact).push(match);
    };

    for (const image of localImages) {
        const haystack = `${image.compactName}\n${image.compactPath}`;
        const matchedCompacts = new Set([...haystack.matchAll(skuRegex)].map((match) => match[0]));
        for (const compact of matchedCompacts) {
            for (const sku of compactToSkus.get(compact) ?? []) addMatch(sku, image);
        }
    }
    return bySku;
}

function buildCompactSkuIndex(products) {
    const compactToSkus = new Map();
    for (const product of products) {
        for (const sku of productSkuKeys(product)) {
            const compact = compactSku(sku);
            if (compact.length < 5) continue;
            if (!compactToSkus.has(compact)) compactToSkus.set(compact, new Set());
            compactToSkus.get(compact).add(sku);
        }
    }
    return new Map([...compactToSkus.entries()].map(([key, value]) => [key, [...value]]));
}

function buildSkuRegex(compactSkuKeys) {
    const keys = [...compactSkuKeys].filter((key) => key.length >= 5).sort((a, b) => b.length - a.length);
    return keys.length ? new RegExp(keys.join("|"), "g") : null;
}

export function collectImageUrls(value, out = []) {
    if (typeof value === "string") {
        const url = value.trim();
        if (isHttpImageUrl(url)) out.push(url);
        return out;
    }
    if (Array.isArray(value)) {
        for (const item of value) collectImageUrls(item, out);
        return out;
    }
    if (value && typeof value === "object") {
        for (const child of Object.values(value)) collectImageUrls(child, out);
    }
    return out;
}

function collectStrings(value, out = []) {
    if (typeof value === "string") {
        out.push(value);
        return out;
    }
    if (Array.isArray(value)) {
        for (const item of value) collectStrings(item, out);
        return out;
    }
    if (value && typeof value === "object") {
        for (const child of Object.values(value)) collectStrings(child, out);
    }
    return out;
}

export function rowIdentities(row) {
    const content = row?.published_content && typeof row.published_content === "object" ? row.published_content : {};
    const nested = content.pipelineSkuJob && typeof content.pipelineSkuJob === "object" ? content.pipelineSkuJob : {};
    const bestBottlesConvex = content.bestBottlesConvex && typeof content.bestBottlesConvex === "object" ? content.bestBottlesConvex : {};
    return Array.from(new Set([
        row?.grace_sku,
        row?.graceSku,
        row?.website_sku,
        row?.websiteSku,
        row?.shopify_sku,
        row?.shopifySku,
        row?.sku,
        row?.primary_grace_sku,
        row?.primaryGraceSku,
        row?.primary_website_sku,
        row?.primaryWebsiteSku,
        nested.graceSku,
        nested.grace_sku,
        nested.websiteSku,
        nested.website_sku,
        nested.shopifySku,
        nested.shopify_sku,
        bestBottlesConvex.graceSku,
        bestBottlesConvex.websiteSku,
        bestBottlesConvex.shopifySku,
    ].map(clean).filter(Boolean)));
}

export function buildMadisonEvidenceBySku({ products, recordsBySource }) {
    const bySku = new Map();
    const compactToSkus = buildCompactSkuIndex(products);
    const skuRegex = buildSkuRegex(compactToSkus.keys());

    for (const [source, records] of Object.entries(recordsBySource)) {
        for (const record of records) {
            const imageUrls = collectImageUrls(record);
            if (!imageUrls.length) continue;
            const strings = collectStrings(record).join("\n");
            const identities = rowIdentities(record);
            const matched = new Set();
            for (const id of identities) {
                if (!id) continue;
                matched.add(id);
                matched.add(compactSku(id));
            }
            if (source === "generated_images") {
                const compactStrings = compactSku(strings);
                if (skuRegex) {
                    const matchedCompacts = new Set([...compactStrings.matchAll(skuRegex)].map((match) => match[0]));
                    for (const compact of matchedCompacts) {
                        for (const sku of compactToSkus.get(compact) ?? []) matched.add(sku);
                        matched.add(compact);
                    }
                }
            }
            for (const key of matched) {
                if (!key) continue;
                if (!bySku.has(key)) bySku.set(key, []);
                bySku.get(key).push({
                    source,
                    id: clean(record.id),
                    imageUrls: imageUrls.slice(0, 3),
                    status: clean(record.status || record.review_status || record.approval_status),
                });
            }
        }
    }
    return bySku;
}

function csvEscape(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function writeCsv(path, rows, headers) {
    mkdirSync(dirname(path), { recursive: true });
    const csv = [
        headers.map(csvEscape).join(","),
        ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
    ].join("\n") + "\n";
    writeFileSync(path, csv);
}

function manifestRow(row, idx, cycleId, mode, root) {
    return {
        cycleId,
        launchOrder: idx,
        pipelineLaneId: PIPELINE_LANE_ID,
        mode,
        graceSku: row.graceSku,
        websiteSku: row.websiteSku || null,
        family: row.family || null,
        productGroupSlug: row.productGroupSlug || null,
        productGroupDisplayName: row.itemName || null,
        applicator: row.applicator || null,
        capacityMl: row.capacityMl != null ? String(row.capacityMl) : null,
        color: row.color || null,
        materialBucket: row.materialBucket || null,
        referenceSource: row.referenceSource || null,
        bestReferenceCandidatePath: row.referencePath ? relative(root, row.referencePath) : null,
        absoluteReferencePath: row.referencePath || null,
        liveReferenceUrl: row.referenceUrl || null,
        expectedCanonicalFilename: row.websiteSku
            ? `${row.graceSku}__${row.websiteSku}__pdp-main__v001.png`
            : `${row.graceSku}__pdp-main__v001.png`,
    };
}

export function buildMadisonGenerationManifest({ rows, name, mode = "cap-on", root, generatedAt = new Date().toISOString() }) {
    const cycleId = `${name}-${generatedAt.slice(0, 10)}`;
    return {
        generatedAt,
        source: "audit_image_generation_coverage.mjs",
        operationalRule: "Generate prompt-ready SKUs that lack trusted Shopify/Madison image coverage.",
        pipelineLaneId: PIPELINE_LANE_ID,
        mode,
        cycleId,
        totalRows: rows.length,
        rows: rows.map((row, index) => manifestRow(row, index + 1, cycleId, mode, root)),
    };
}

export function writeAuditArtifacts({ audit, outDir, root, mode = "cap-on" }) {
    mkdirSync(outDir, { recursive: true });
    const headers = [
        "coverageStatus",
        "generationBucket",
        "referenceStatus",
        "coverageSource",
        "graceSku",
        "websiteSku",
        "family",
        "productGroupSlug",
        "itemName",
        "color",
        "capacity",
        "capacityMl",
        "applicator",
        "capStyle",
        "capColor",
        "materialBucket",
        "currentImageUrl",
        "currentImageUrlCapOff",
        "coverageEvidenceUrl",
        "referenceSource",
        "referencePath",
        "referenceUrl",
        "productUrl",
        "missingPromptFields",
    ];

    const jsonPath = resolve(outDir, "image_generation_coverage.json");
    const csvPath = resolve(outDir, "image_generation_coverage.csv");
    const summaryPath = resolve(outDir, "image_generation_summary.md");
    const localRows = audit.rows.filter((row) => row.generationBucket === "generate_from_local_reference");
    const legacyRows = audit.rows.filter((row) => row.generationBucket === "generate_from_legacy_reference");
    const localManifest = buildMadisonGenerationManifest({
        rows: localRows,
        name: "best-bottles-local-reference-generation",
        mode,
        root,
        generatedAt: audit.generatedAt,
    });
    const legacyManifest = buildMadisonGenerationManifest({
        rows: legacyRows,
        name: "best-bottles-legacy-reference-generation",
        mode,
        root,
        generatedAt: audit.generatedAt,
    });
    const localManifestPath = resolve(outDir, "madison_manifest_local_reference.json");
    const legacyManifestPath = resolve(outDir, "madison_manifest_legacy_reference.json");

    writeFileSync(jsonPath, JSON.stringify(audit, null, 2));
    writeCsv(csvPath, audit.rows, headers);
    writeFileSync(localManifestPath, JSON.stringify(localManifest, null, 2));
    writeFileSync(legacyManifestPath, JSON.stringify(legacyManifest, null, 2));
    writeFileSync(summaryPath, renderSummaryMarkdown({ audit, paths: { jsonPath, csvPath, localManifestPath, legacyManifestPath } }));

    return { jsonPath, csvPath, summaryPath, localManifestPath, legacyManifestPath };
}

function topFamilies(summary, count = 20) {
    return Object.entries(summary.byFamily)
        .sort((a, b) => b[1].needsGeneration - a[1].needsGeneration || b[1].total - a[1].total)
        .slice(0, count);
}

export function renderSummaryMarkdown({ audit, paths }) {
    const s = audit.summary;
    const lines = [
        "# Best Bottles Image Generation Coverage Audit",
        "",
        `Generated: ${audit.generatedAt}`,
        "",
        "## Headline Counts",
        "",
        `- Catalog SKU rows audited: ${s.totalProducts}`,
        `- Rows with trusted existing media: ${s.coveredExistingMedia}`,
        `- Rows with Madison/generated evidence not necessarily synced to Convex: ${s.coveredMadisonNotSynced}`,
        `- Rows still needing generation: ${s.needsGeneration}`,
        `- Ready from local repo reference images: ${s.generateFromLocalReference}`,
        `- Ready from legacy bestbottles.com image URLs: ${s.generateFromLegacyReference}`,
        `- Need legacy product-page lookup/scrape: ${s.legacySiteLookupNeeded}`,
        `- Need manual reference sourcing: ${s.manualReferenceNeeded}`,
        `- Prompt-incomplete rows: ${s.promptIncompleteRows}`,
        "",
        "## Output Files",
        "",
        `- Full JSON: ${paths.jsonPath}`,
        `- Full CSV: ${paths.csvPath}`,
        `- Madison local-reference manifest: ${paths.localManifestPath}`,
        `- Madison legacy-reference manifest: ${paths.legacyManifestPath}`,
        "",
        "## Largest Family Gaps",
        "",
        "| Family | Total | Covered | Needs Generation | Local Ref | Legacy Ref | Lookup | Manual |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ];

    for (const [family, row] of topFamilies(s)) {
        lines.push(`| ${family} | ${row.total} | ${row.covered} | ${row.needsGeneration} | ${row.localReference} | ${row.legacyReference} | ${row.lookupNeeded} | ${row.manualReference} |`);
    }

    lines.push(
        "",
        "## Classification Rule",
        "",
        audit.coverageRule,
        "",
        "Legacy bestbottles.com images are treated as reference inputs, not completed new-site media.",
        "",
    );

    return `${lines.join("\n")}\n`;
}
