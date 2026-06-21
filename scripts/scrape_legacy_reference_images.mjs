#!/usr/bin/env node
/**
 * Read-only legacy reference image intake for Best Bottles.
 *
 * Downloads legacy bestbottles.com product images as reference assets for
 * Madison/AiOS generation. This script writes local files and manifests only.
 * It does not write to Shopify, Convex, Sanity, or Madison.
 */

import { copyFileSync, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { pipeline } from "node:stream/promises";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SITEMAP_URL = "https://www.bestbottles.com/sitemap.xml";
const DEFAULT_OUTPUT_ROOT = resolve(ROOT, "pipeline/aios-shopify-pdp-images/00-input/legacy-reference");
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121 Safari/537.36";
const IMAGE_EXTENSIONS = new Set([".gif", ".jpg", ".jpeg", ".png", ".webp"]);
const DEFAULT_LOCAL_SOURCE_DIRS = [
    "pipeline/aios-shopify-pdp-images/00-input/reference-flattened",
    "pipeline/aios-shopify-pdp-images/00-input/gpt-image-2-smoke-reference",
    "pipeline/image-gen/grid-images/approved",
    "pipeline/image-gen/grid-images/reference",
    "pipeline/image-gen/grid-images/output",
    "pipeline/madison-hero-sync/renders",
];

const SPEC_LABELS = [
    "Item Type",
    "Item Name",
    "Item Description",
    "Item Capacity",
    "Item Height with Cap",
    "Item Height without Cap",
    "Item Diameter",
    "Item Width",
    "Item Depth",
    "Neck Thread Size",
    "Closure Type",
];

const FIELD_BY_LABEL = {
    "Item Type": "itemType",
    "Item Name": "websiteSku",
    "Item Description": "itemDescription",
    "Item Capacity": "capacity",
    "Item Height with Cap": "heightWithCap",
    "Item Height without Cap": "heightWithoutCap",
    "Item Diameter": "diameter",
    "Item Width": "width",
    "Item Depth": "depth",
    "Neck Thread Size": "neckThreadSize",
    "Closure Type": "closureType",
};

export function clean(value) {
    return typeof value === "string" ? value.trim() : "";
}

export function normalizeText(value) {
    return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function compactSku(value) {
    return clean(value).replace(/[^a-z0-9]/gi, "").toUpperCase();
}

export function slugify(value) {
    return normalizeText(value).replace(/\s+/g, "-");
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripHtmlToText(html) {
    return clean(html)
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/\s+/g, " ")
        .trim();
}

function extractLabeledText(pageText, label) {
    const stopPattern = SPEC_LABELS.map(escapeRegExp).join("|");
    const pattern = new RegExp(`${escapeRegExp(label)}\\s*:\\s*(.+?)(?=(?:${stopPattern})\\s*:|1\\s*pcs?\\s*[-–]|$)`, "i");
    const match = pageText.match(pattern);
    return match
        ? clean(match[1]).replace(/\s*Nemat International.*$/i, "").replace(/\s*Copyright\s+\d{4}.*$/i, "")
        : null;
}

function normalizeCapacityMl(value) {
    const match = clean(value).match(/(\d+(?:\.\d+)?)\s*ml\b/i);
    return match ? Number(match[1]) : null;
}

function normalizeNeckThread(value) {
    const match = clean(value).match(/\b\d{2}-\d{3}\b/);
    return match ? match[0] : clean(value) || null;
}

function inferIdentity(fields) {
    const haystack = normalizeText([
        fields.productUrl,
        fields.itemType,
        fields.websiteSku,
        fields.itemDescription,
    ].filter(Boolean).join(" "));
    const productText = normalizeText([
        fields.productUrl,
        fields.websiteSku,
        fields.itemDescription,
    ].filter(Boolean).join(" "));

    const family = /\bboston round\b/.test(haystack)
        ? "Boston Round"
        : /\bvial\b|\bvials\b/.test(haystack)
            ? "Vial"
        : /\bcylinder\b/.test(haystack)
            ? "Cylinder"
            : null;
    const color =
        /\bcobalt blue\b|\bblue glass\b/.test(haystack) ? "Cobalt Blue" :
        /\bamber glass\b|\bamber bottle\b/.test(haystack) ? "Amber" :
        /\bclear glass\b|\bclear bottle\b/.test(haystack) ? "Clear" :
        /\bfrosted glass\b|\bfrosted bottle\b/.test(haystack) ? "Frosted" :
        /\bgreen glass\b|\bgreen bottle\b/.test(haystack) ? "Green" :
        /\bwhite glass\b|\bwhite bottle\b/.test(haystack) ? "White" :
        null;
    const applicator =
        /\bmetal roller\b|\bmetal roll\b/.test(productText) ? "Metal Roll-On" :
        /\bplastic roller\b|\bplastic roll\b/.test(productText) ? "Plastic Roll-On" :
        /\bglass rod\b|\bglass wand\b/.test(productText) ? "Glass Rod" :
        /\broll on\b|\broll-on\b|\broller\b/.test(productText) ? "Roll-On" :
        /\bdropper\b/.test(productText) ? "Dropper" :
        /\bfine mist\b|\bspray\b|\bsprayer\b/.test(productText) ? "Sprayer" :
        /\blotion pump\b/.test(productText) ? "Lotion Pump" :
        /\bcap\b/.test(productText) ? "Cap/Closure" :
        null;

    return { family, color, applicator };
}

function absolutizeUrl(value, baseUrl) {
    if (!value) return null;
    try {
        return new URL(value, baseUrl || "https://www.bestbottles.com/").href;
    } catch {
        return value;
    }
}

export function extractImageUrls(html, pageUrl) {
    const urls = [];
    const seen = new Set();
    for (const match of html.matchAll(/<img\b[^>]*(?:data-original|data-src|src)=["']([^"']+\.(?:gif|jpg|jpeg|png|webp)(?:\?[^"']*)?)["'][^>]*>/gi)) {
        const raw = match[1];
        if (!/(?:enlarged_pics|store\/capped|images\/store|\/store\/)/i.test(raw)) continue;
        const url = absolutizeUrl(raw, pageUrl);
        const key = url.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        urls.push(url);
    }
    return urls.sort((a, b) => imageRank(a) - imageRank(b));
}

function imageRank(url) {
    if (/enlarged_pics/i.test(url)) return 0;
    if (/store\/capped/i.test(url)) return 1;
    if (/images\/store/i.test(url)) return 2;
    return 3;
}

export function parseLegacyReferencePage({ html, url }) {
    const pageText = stripHtmlToText(html);
    const data = { productUrl: url };
    for (const label of SPEC_LABELS) {
        const value = extractLabeledText(pageText, label);
        if (value) data[FIELD_BY_LABEL[label]] = value;
    }

    const imageUrls = extractImageUrls(html, url);
    if (!data.websiteSku) {
        const filenameSku = imageUrls[0]?.split("/").pop()?.split("?")[0]?.replace(/\.[^.]+$/, "");
        if (filenameSku) data.websiteSku = filenameSku;
    }

    data.capacityMl = normalizeCapacityMl(data.capacity || data.itemDescription || "");
    data.neckThreadSize = normalizeNeckThread(data.neckThreadSize);
    data.imageUrls = imageUrls;
    data.primaryImageUrl = imageUrls[0] ?? null;
    Object.assign(data, inferIdentity(data));
    return data;
}

function isImageFile(filePath) {
    return IMAGE_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function listImageFiles(rootPath) {
    if (!existsSync(rootPath)) return [];
    const files = [];
    const stack = [rootPath];
    while (stack.length > 0) {
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

export function buildLocalReferenceIndex(sourceDirs) {
    return sourceDirs
        .map((sourceDir) => resolve(ROOT, sourceDir))
        .flatMap((sourceDir) => listImageFiles(sourceDir))
        .map((filePath) => ({
            path: filePath,
            relativePath: filePath.replace(`${ROOT}/`, ""),
            compactName: compactSku(basename(filePath)),
            normalizedPath: normalizeText(filePath.replace(`${ROOT}/`, "")),
        }));
}

function localReferenceScore(localImage, legacyProduct, match) {
    const strongKeys = [
        match.product?.graceSku,
        match.product?.websiteSku,
        legacyProduct.websiteSku,
    ].map(compactSku).filter((value) => value.length >= 5);

    for (const key of strongKeys) {
        if (localImage.compactName.includes(key)) return 120;
    }

    const slug = normalizeText(match.product?.slug || "");
    if (slug && localImage.normalizedPath.includes(slug)) return 90;

    const tokens = [
        match.product?.family ?? legacyProduct.family,
        match.product?.capacity ?? legacyProduct.capacity,
        legacyProduct.capacityMl ? `${legacyProduct.capacityMl}ml` : "",
        match.product?.color ?? legacyProduct.color,
        match.product?.applicator ?? legacyProduct.applicator,
    ].map(normalizeText).filter((value) => value && !["glass bottle", "bottle", "clear"].includes(value));

    const tokenHits = tokens.filter((token) => localImage.normalizedPath.includes(token)).length;
    if (tokenHits >= 4) return 70 + tokenHits;
    return tokenHits >= 3 ? 55 + tokenHits : tokenHits;
}

export function findLocalReferenceMatch({ localReferenceIndex, legacyProduct, match }) {
    let best = null;
    for (const localImage of localReferenceIndex) {
        const score = localReferenceScore(localImage, legacyProduct, match);
        if (!best || score > best.score) best = { ...localImage, score };
    }
    return best && best.score >= 70 ? best : null;
}

function csvCell(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function manifestCsv(rows) {
    const headers = [
        "matchStatus",
        "family",
        "productSlug",
        "websiteSku",
        "graceSku",
        "legacyUrl",
        "legacyImageUrl",
        "sourceType",
        "localReferencePath",
        "localMatchScore",
        "capacity",
        "capacityMl",
        "color",
        "neckThreadSize",
        "applicator",
        "itemType",
        "itemDescription",
        "notes",
    ];
    return [
        headers.map(csvCell).join(","),
        ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
    ].join("\n");
}

function loadEnvLocal() {
    const envPath = resolve(ROOT, ".env.local");
    if (!existsSync(envPath)) return;
    for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#") || !line.includes("=")) continue;
        const [key, ...rest] = line.split("=");
        if (!process.env[key.trim()]) {
            process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
        }
    }
}

function argValues(name) {
    const values = [];
    for (let i = 2; i < process.argv.length; i += 1) {
        if (process.argv[i] === name && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) values.push(process.argv[i + 1]);
    }
    return values;
}

function parseArgs() {
    const get = (name) => argValues(name).at(-1) ?? null;
    const families = argValues("--family").flatMap((value) => value.split(",")).map(clean).filter(Boolean);
    const legacyUrls = argValues("--legacy-url").flatMap((value) => value.split(",")).map(clean).filter(Boolean);
    const localSourceDirs = argValues("--local-source").flatMap((value) => value.split(",")).map(clean).filter(Boolean);
    return {
        families,
        legacyUrls,
        urlsFile: get("--urls-file"),
        outputRoot: get("--output-root") ?? DEFAULT_OUTPUT_ROOT,
        localSourceDirs: localSourceDirs.length > 0 ? localSourceDirs : DEFAULT_LOCAL_SOURCE_DIRS,
        limit: Number(get("--limit") ?? "0") || null,
        delayMs: Math.max(0, Number(get("--delay-ms") ?? "500") || 0),
        dryRun: process.argv.includes("--dry-run"),
        overwrite: process.argv.includes("--overwrite"),
        localFirst: !process.argv.includes("--no-local-first"),
        copyLocal: process.argv.includes("--copy-local"),
    };
}

async function fetchText(url) {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.text();
}

async function fetchBuffer(url) {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response;
}

function parseSitemapProductUrls(xml) {
    return [...xml.matchAll(/<loc>\s*([^<]*\/product\/[^<]+)\s*<\/loc>/gi)].map((match) => match[1].trim());
}

function familyUrlMatch(url, family) {
    const normalizedUrl = normalizeText(url);
    const normalizedFamily = normalizeText(family);
    if (!normalizedFamily) return true;
    if (normalizedFamily === "boston round") return /\bboston round\b|\bboston\b/.test(normalizedUrl);
    return normalizedUrl.includes(normalizedFamily);
}

async function loadProductUrls(args) {
    if (args.legacyUrls.length > 0) return args.legacyUrls;
    if (args.urlsFile) {
        const payload = JSON.parse(readFileSync(resolve(ROOT, args.urlsFile), "utf8"));
        return Array.isArray(payload) ? payload : payload.urls ?? [];
    }

    const urls = parseSitemapProductUrls(await fetchText(SITEMAP_URL));
    const filtered = args.families.length > 0
        ? urls.filter((url) => args.families.some((family) => familyUrlMatch(url, family)))
        : urls;
    return args.limit ? filtered.slice(0, args.limit) : filtered;
}

async function fetchConvexProducts() {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) return [];
    const client = new ConvexHttpClient(convexUrl);
    const products = [];
    let cursor = null;
    while (true) {
        const page = await client.action(api.products.getProductExportPage, { cursor, numItems: 250 });
        products.push(...page.page);
        if (page.isDone) return products;
        cursor = page.continueCursor;
    }
}

function findConvexMatch(products, legacyProduct) {
    const legacySku = compactSku(legacyProduct.websiteSku);
    const exact = products.find((product) =>
        compactSku(product.websiteSku) === legacySku ||
        compactSku(product.graceSku) === legacySku
    );
    if (exact) return { product: exact, status: "matched_convex_product" };

    const legacyUrlTail = normalizeText(legacyProduct.productUrl.split("/").pop() || "");
    const urlMatch = products.find((product) => {
        const slug = normalizeText(product.slug || "");
        const productUrl = normalizeText(product.productUrl || "");
        return legacyUrlTail && (slug.includes(legacyUrlTail) || productUrl.includes(legacyUrlTail));
    });
    if (urlMatch) return { product: urlMatch, status: "matched_convex_url" };

    return { product: null, status: "missing_convex_match" };
}

function safeFileToken(value, fallback) {
    return clean(value || fallback).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function extensionFromUrl(url) {
    const pathname = new URL(url).pathname;
    const ext = extname(pathname).toLowerCase();
    return ext || ".jpg";
}

function localReferenceFilename({ legacyProduct, match, imageUrl, index }) {
    const graceSku = match.product?.graceSku ? safeFileToken(match.product.graceSku, "UNMATCHED") : "UNMATCHED";
    const websiteSku = safeFileToken(legacyProduct.websiteSku, `legacy-${index + 1}`);
    const ext = extensionFromUrl(imageUrl);
    return `${graceSku}__${websiteSku}__legacy-reference__v001${ext}`;
}

async function downloadImage({ imageUrl, outputPath, overwrite }) {
    if (existsSync(outputPath) && !overwrite) return "skipped_existing";
    const response = await fetchBuffer(imageUrl);
    await pipeline(response.body, createWriteStream(outputPath));
    return "downloaded";
}

function sleep(ms) {
    return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function main() {
    loadEnvLocal();
    const args = parseArgs();
    const productUrls = await loadProductUrls(args);
    const familyFolder = slugify(args.families[0] || "legacy-products") || "legacy-products";
    const outputDir = resolve(ROOT, args.outputRoot, familyFolder);
    const imagesDir = resolve(outputDir, "images");
    mkdirSync(imagesDir, { recursive: true });

    const convexProducts = await fetchConvexProducts();
    const localReferenceIndex = args.localFirst ? buildLocalReferenceIndex(args.localSourceDirs) : [];
    const rows = [];
    const errors = [];
    const urlsToProcess = args.limit && args.legacyUrls.length > 0 ? productUrls.slice(0, args.limit) : productUrls;

    for (let index = 0; index < urlsToProcess.length; index += 1) {
        const productUrl = urlsToProcess[index];
        try {
            const legacyProduct = parseLegacyReferencePage({ html: await fetchText(productUrl), url: productUrl });
            const match = findConvexMatch(convexProducts, legacyProduct);
            const imageUrl = legacyProduct.primaryImageUrl;
            const localMatch = findLocalReferenceMatch({ localReferenceIndex, legacyProduct, match });
            const filename = imageUrl ? localReferenceFilename({ legacyProduct, match, imageUrl, index }) : null;
            const scrapedReferencePath = filename ? resolve(imagesDir, filename) : null;
            const copiedLocalPath = localMatch && args.copyLocal
                ? resolve(imagesDir, `${safeFileToken(match.product?.graceSku, "LOCAL")}__${safeFileToken(legacyProduct.websiteSku, `legacy-${index + 1}`)}__local-reference__v001${extname(localMatch.path)}`)
                : null;
            let localReferencePath = localMatch?.path ?? scrapedReferencePath;
            let sourceType = localMatch ? "local_pipeline" : "legacy_scrape";
            let note = "";

            if (localMatch) {
                if (copiedLocalPath && !args.dryRun) {
                    if (!existsSync(copiedLocalPath) || args.overwrite) copyFileSync(localMatch.path, copiedLocalPath);
                    localReferencePath = copiedLocalPath;
                    note = "local_match_copied_or_existing";
                } else {
                    note = args.copyLocal ? "dry_run_local_copy" : "local_match";
                }
            } else if (imageUrl && scrapedReferencePath && !args.dryRun) {
                note = await downloadImage({ imageUrl, outputPath: scrapedReferencePath, overwrite: args.overwrite });
            } else {
                note = imageUrl ? "dry_run_legacy_scrape" : "missing_image";
                if (!imageUrl) sourceType = "missing_reference";
            }

            rows.push({
                matchStatus: match.status,
                family: match.product?.family ?? legacyProduct.family ?? "",
                productSlug: match.product?.slug ?? "",
                websiteSku: legacyProduct.websiteSku ?? match.product?.websiteSku ?? "",
                graceSku: match.product?.graceSku ?? "",
                legacyUrl: productUrl,
                legacyImageUrl: imageUrl ?? "",
                sourceType,
                localReferencePath: localReferencePath ? localReferencePath.replace(`${ROOT}/`, "") : "",
                localMatchScore: localMatch?.score ?? "",
                capacity: legacyProduct.capacity ?? "",
                capacityMl: legacyProduct.capacityMl ?? "",
                color: match.product?.color ?? legacyProduct.color ?? "",
                neckThreadSize: match.product?.neckThreadSize ?? legacyProduct.neckThreadSize ?? "",
                applicator: match.product?.applicator ?? legacyProduct.applicator ?? "",
                itemType: legacyProduct.itemType ?? "",
                itemDescription: legacyProduct.itemDescription ?? "",
                notes: note,
            });
        } catch (error) {
            errors.push({ productUrl, error: error.message });
        }
        if (args.delayMs > 0) await sleep(args.delayMs);
    }

    const summary = {
        generatedAt: new Date().toISOString(),
        mode: "read-only",
        source: "bestbottles.com legacy product pages",
        localFirst: args.localFirst,
        localSourceDirs: args.localSourceDirs,
        localReferenceImageCount: localReferenceIndex.length,
        outputDir,
        requestedFamilies: args.families,
        productUrlCount: urlsToProcess.length,
        referenceCount: rows.length,
        errorCount: errors.length,
        matchedConvexCount: rows.filter((row) => row.matchStatus.startsWith("matched_convex")).length,
        missingConvexCount: rows.filter((row) => row.matchStatus === "missing_convex_match").length,
        missingImageCount: rows.filter((row) => !row.legacyImageUrl).length,
        localPipelineMatchCount: rows.filter((row) => row.sourceType === "local_pipeline").length,
        legacyScrapeCount: rows.filter((row) => row.sourceType === "legacy_scrape").length,
        dryRun: args.dryRun,
        rows,
        errors,
    };

    writeFileSync(resolve(outputDir, "legacy_reference_manifest.json"), JSON.stringify(summary, null, 2));
    writeFileSync(resolve(outputDir, "legacy_reference_manifest.csv"), manifestCsv(rows));
    console.log(JSON.stringify({
        outputDir,
        referenceCount: summary.referenceCount,
        errorCount: summary.errorCount,
        matchedConvexCount: summary.matchedConvexCount,
        missingConvexCount: summary.missingConvexCount,
        missingImageCount: summary.missingImageCount,
        localPipelineMatchCount: summary.localPipelineMatchCount,
        legacyScrapeCount: summary.legacyScrapeCount,
        dryRun: args.dryRun,
    }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
}
