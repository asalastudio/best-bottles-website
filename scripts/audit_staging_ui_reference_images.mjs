#!/usr/bin/env node
/**
 * Rendered Best Bottles staging UI legacy/reference image audit.
 *
 * Local-dev first. Starts from the June 15 launch audit CSVs, opens catalog
 * family pages and PDPs, records actual rendered product image URLs, and flags
 * only rows with legacy/reference provenance.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import {
    buildRenderedUiAudit,
    clean,
    readCsvIfExists,
    writeRenderedUiAuditArtifacts,
} from "./lib/staging-ui-reference-audit.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_AUDIT_ROOT = resolve(ROOT, "data/audits/stage-in-sight-image-sync-2026-06-15");
const DEFAULT_OUT_DIR = resolve(DEFAULT_AUDIT_ROOT, "ui-reference-render-audit");
const DEFAULT_MADISON_PUBLIC_JSON =
    "/Users/jordanrichter/Projects/Madison Studio/madison-app/public/data/best-bottles-staging-ui-reference-audit.json";

function argValue(name, fallback = null) {
    const index = process.argv.indexOf(name);
    if (index < 0) return fallback;
    const value = process.argv[index + 1];
    return value && !value.startsWith("--") ? value : fallback;
}

function hasFlag(name) {
    return process.argv.includes(name);
}

function parseCsvList(value) {
    return clean(value)
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
}

function parseArgs() {
    return {
        baseUrl: clean(argValue("--base-url", "http://localhost:3000")).replace(/\/+$/, ""),
        outDir: resolve(argValue("--out-dir", DEFAULT_OUT_DIR)),
        auditRoot: resolve(argValue("--audit-root", DEFAULT_AUDIT_ROOT)),
        families: parseCsvList(argValue("--family", "")),
        surfaces: new Set(parseCsvList(argValue("--surfaces", "catalog,pdp"))),
        limit: Number(argValue("--limit", "0")) || 0,
        catalogLimit: Number(argValue("--catalog-limit", "200")) || 200,
        madisonPublicJson: argValue("--madison-public-json", DEFAULT_MADISON_PUBLIC_JSON),
        writeMadisonPublic: hasFlag("--write-madison-public"),
        executablePath: argValue("--chrome-path", process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH),
    };
}

function loadAuditInputs(auditRoot) {
    return {
        legacyReferenceRows: readCsvIfExists(resolve(auditRoot, "coordinator/legacy_reference_image_still_showing.csv")),
        suspiciousSyncedRows: readCsvIfExists(resolve(auditRoot, "coordinator/suspicious_synced_reference_rows.csv")),
        reconciliationRows: readCsvIfExists(resolve(auditRoot, "cleanup/launch_image_reconciliation_manifest.csv")),
        skuTruthRows: readCsvIfExists(resolve(auditRoot, "agent-2/sku-image-truth-rollup.csv")),
    };
}

function unique(values) {
    return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function familiesFromAuditInputs(inputs) {
    return unique([
        ...inputs.legacyReferenceRows.map((row) => row.family),
        ...inputs.reconciliationRows.map((row) => row.family),
        ...inputs.skuTruthRows
            .filter((row) => clean(row.legacyReferenceInConvex).toLowerCase() === "yes")
            .map((row) => row.family),
    ]).sort((a, b) => a.localeCompare(b));
}

function rowStagingPath(row) {
    const stagingUrl = clean(row.staging_url);
    if (stagingUrl) return stagingUrl;
    const slug = clean(row.product_group_slug || row.productGroupSlug);
    return slug ? `/products/${slug}` : "";
}

function absoluteUrl(baseUrl, value) {
    const url = clean(value);
    if (!url) return "";
    try {
        return new URL(url, baseUrl).href;
    } catch {
        return "";
    }
}

function buildTargets(options, inputs) {
    const targets = [];
    const families = options.families.length ? options.families : familiesFromAuditInputs(inputs);
    if (options.surfaces.has("catalog")) {
        for (const family of families) {
            const url = new URL("/catalog", options.baseUrl);
            url.searchParams.set("families", family);
            url.searchParams.set("view", "line");
            url.searchParams.set("limit", String(options.catalogLimit));
            targets.push({ surface: "catalog", url: url.href, family });
        }
    }

    if (options.surfaces.has("pdp")) {
        const seen = new Set();
        for (const row of [
            ...inputs.legacyReferenceRows,
            ...inputs.suspiciousSyncedRows,
            ...inputs.reconciliationRows,
        ]) {
            if (options.families.length && row.family && !options.families.includes(row.family)) continue;
            const url = absoluteUrl(options.baseUrl, rowStagingPath(row));
            if (!url || seen.has(url)) continue;
            seen.add(url);
            targets.push({ surface: "pdp", url, family: clean(row.family) });
        }
    }

    return options.limit > 0 ? targets.slice(0, options.limit) : targets;
}

async function resolveChromeExecutable(configuredPath) {
    if (configuredPath && existsSync(configuredPath)) return configuredPath;
    const candidates = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        `${homedir()}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
        `${homedir()}/Applications/Chromium.app/Contents/MacOS/Chromium`,
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate)) return candidate;
    }
    const sparticuzPath = await chromium.executablePath();
    if (sparticuzPath && existsSync(sparticuzPath)) return sparticuzPath;
    throw new Error("No Chrome executable found. Set --chrome-path or CHROME_PATH.");
}

async function launchBrowser(options) {
    const executablePath = await resolveChromeExecutable(options.executablePath);
    return puppeteer.launch({
        executablePath,
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
}

async function collectRenderedImages(page, target) {
    await page.goto(target.url, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForSelector("[data-bb-image-audit]", { timeout: 15000 }).catch(() => null);
    return page.evaluate((targetInfo) => {
        const elements = Array.from(document.querySelectorAll("[data-bb-image-audit]"));
        return elements.map((element) => {
            const img = element.tagName === "IMG"
                ? element
                : element.querySelector("img");
            const dataset = element.dataset || {};
            const imageDataset = img?.dataset || {};
            return {
                surface: dataset.bbImageAudit || imageDataset.bbImageAudit || targetInfo.surface,
                stagingUrl: window.location.href,
                family: dataset.bbFamily || imageDataset.bbFamily || targetInfo.family || "",
                productGroupSlug: dataset.bbProductGroupSlug || imageDataset.bbProductGroupSlug || "",
                graceSku: dataset.bbGraceSku || imageDataset.bbGraceSku || "",
                websiteSku: dataset.bbWebsiteSku || imageDataset.bbWebsiteSku || "",
                shopifyVariantId: dataset.bbShopifyVariantId || imageDataset.bbShopifyVariantId || "",
                renderedImageUrl: img?.currentSrc || img?.src || "",
            };
        }).filter((row) => row.renderedImageUrl || row.productGroupSlug || row.graceSku || row.websiteSku);
    }, target);
}

async function main() {
    const options = parseArgs();
    const inputs = loadAuditInputs(options.auditRoot);
    const targets = buildTargets(options, inputs);
    if (targets.length === 0) throw new Error("No audit targets found.");

    const browser = await launchBrowser(options);
    const renderedImages = [];
    const targetErrors = [];
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(30000);
        await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 1 });
        for (const target of targets) {
            try {
                const rows = await collectRenderedImages(page, target);
                renderedImages.push(...rows);
                console.log(`[staging-ui-audit] ${rows.length} image rows from ${target.url}`);
            } catch (error) {
                targetErrors.push({ target, error: error?.message || String(error) });
                console.warn(`[staging-ui-audit] failed ${target.url}: ${error?.message || error}`);
            }
        }
    } finally {
        await browser.close();
    }

    const audit = buildRenderedUiAudit({
        baseUrl: options.baseUrl,
        renderedImages,
        ...inputs,
    });
    audit.inputs = {
        auditRoot: options.auditRoot,
        targets: targets.length,
        renderedImages: renderedImages.length,
        targetErrors,
        surfaces: Array.from(options.surfaces),
        families: options.families.length ? options.families : "audit-derived",
    };

    const paths = writeRenderedUiAuditArtifacts({ audit, outDir: options.outDir });
    if (options.writeMadisonPublic) {
        mkdirSync(dirname(options.madisonPublicJson), { recursive: true });
        writeFileSync(options.madisonPublicJson, JSON.stringify(audit, null, 2));
        paths.madisonPublicJson = options.madisonPublicJson;
    }

    console.log(JSON.stringify({ outDir: options.outDir, paths, summary: audit.summary }, null, 2));
}

main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exit(1);
});
