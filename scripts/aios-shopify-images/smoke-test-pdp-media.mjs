#!/usr/bin/env node
/**
 * Non-destructive smoke test for AiOS/Madison flattened PDP image manifests.
 *
 * Validates local PNGs, manifest integrity, and optionally live Shopify product
 * and variant IDs. This script never uploads media and never patches Convex.
 *
 * A reference-only manifest proves mapping and file integrity. An upload-ready
 * manifest must use status=approved and pushStatus=pending for every row.
 *
 * Usage:
 *   node scripts/aios-shopify-images/smoke-test-pdp-media.mjs
 *   node scripts/aios-shopify-images/smoke-test-pdp-media.mjs --live-shopify
 *   node scripts/aios-shopify-images/smoke-test-pdp-media.mjs --manifest path/to.csv --live-shopify
 */

import { createHash } from "crypto";
import {
    existsSync,
    mkdirSync,
    readFileSync,
    statSync,
    writeFileSync,
} from "fs";
import { basename, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const DEFAULT_MANIFEST = resolve(
    ROOT,
    "pipeline/aios-shopify-pdp-images/01-manifests/2026-05-14-empire-50ml-ast-reference-mapping-smoke-test.csv",
);
const EXPECTED_WIDTH = 2080;
const EXPECTED_HEIGHT = 2288;
const SHOPIFY_API_VERSION = "2025-01";

const REQUIRED_COLUMNS = [
    "productSlug",
    "productDisplayName",
    "websiteSku",
    "graceSku",
    "shopifyProductId",
    "shopifyVariantId",
    "family",
    "capacityMl",
    "applicator",
    "optionLabel",
    "imageRole",
    "filename",
    "relativePath",
    "width",
    "height",
    "bytes",
    "sha256",
    "status",
    "pushStatus",
];

function parseArgs() {
    const args = {
        manifest: DEFAULT_MANIFEST,
        liveShopify: false,
        writeReport: true,
    };

    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];
        if (arg === "--manifest" && process.argv[i + 1]) {
            args.manifest = resolve(process.argv[++i]);
        } else if (arg === "--live-shopify") {
            args.liveShopify = true;
        } else if (arg === "--no-report") {
            args.writeReport = false;
        } else if (arg === "--help" || arg === "-h") {
            console.log(`
Usage:
  node scripts/aios-shopify-images/smoke-test-pdp-media.mjs [options]

Options:
  --manifest <path>   CSV manifest to validate
  --live-shopify      Also verify Shopify product/variant IDs read-only
  --no-report         Do not write a JSON report
`);
            process.exit(0);
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return args;
}

function loadEnvLocal() {
    const envPath = resolve(ROOT, ".env.local");
    if (!existsSync(envPath)) return;

    for (const line of readFileSync(envPath, "utf8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const eqIdx = trimmed.indexOf("=");
        if (eqIdx < 0) continue;

        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if (value.includes("#")) value = value.slice(0, value.indexOf("#")).trim();
        value = value.replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = value;
    }
}

function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];

        if (ch === '"' && inQuotes && next === '"') {
            cell += '"';
            i++;
        } else if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
            row.push(cell);
            cell = "";
        } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
            if (ch === "\r" && next === "\n") i++;
            row.push(cell);
            if (row.some((v) => v.length > 0)) rows.push(row);
            row = [];
            cell = "";
        } else {
            cell += ch;
        }
    }

    row.push(cell);
    if (row.some((v) => v.length > 0)) rows.push(row);

    const headers = rows.shift() ?? [];
    return rows.map((values, index) => {
        const record = { __rowNumber: index + 2 };
        for (let i = 0; i < headers.length; i++) record[headers[i]] = values[i] ?? "";
        return record;
    });
}

function sha256(filePath) {
    return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function addUniqueCheck(rows, field, errors) {
    const seen = new Map();
    for (const row of rows) {
        const value = row[field];
        if (!value) continue;
        if (seen.has(value)) {
            errors.push(
                `Row ${row.__rowNumber}: duplicate ${field} "${value}" also appears on row ${seen.get(value)}`,
            );
        } else {
            seen.set(value, row.__rowNumber);
        }
    }
}

function inferPipelineRoot(manifestPath) {
    const manifestDir = dirname(manifestPath);
    if (basename(manifestDir) === "01-manifests") return dirname(manifestDir);
    return resolve(ROOT, "pipeline/aios-shopify-pdp-images");
}

async function validateLocalManifest(manifestPath) {
    const errors = [];
    const warnings = [];

    if (!existsSync(manifestPath)) {
        throw new Error(`Manifest not found: ${manifestPath}`);
    }

    const raw = readFileSync(manifestPath, "utf8");
    const header = raw.split(/\r?\n/, 1)[0]?.split(",") ?? [];
    const rows = parseCsv(raw);
    const pipelineRoot = inferPipelineRoot(manifestPath);

    for (const col of REQUIRED_COLUMNS) {
        if (!header.includes(col)) errors.push(`Missing required column: ${col}`);
    }

    if (rows.length === 0) errors.push("Manifest has no data rows");

    addUniqueCheck(rows, "websiteSku", errors);
    addUniqueCheck(rows, "graceSku", errors);
    addUniqueCheck(rows, "shopifyVariantId", errors);
    addUniqueCheck(rows, "filename", errors);

    const products = new Set();
    const files = [];
    let totalBytes = 0;
    let approvedRows = 0;
    let referenceOnlyRows = 0;

    for (const row of rows) {
        products.add(row.shopifyProductId);

        for (const col of REQUIRED_COLUMNS) {
            if (!row[col]) errors.push(`Row ${row.__rowNumber}: missing ${col}`);
        }

        if (row.status === "approved") {
            approvedRows++;
        } else if (row.status === "reference_only") {
            referenceOnlyRows++;
        } else {
            errors.push(`Row ${row.__rowNumber}: unsupported status "${row.status}"`);
        }

        if (!["pending", "not_for_upload"].includes(row.pushStatus)) {
            errors.push(`Row ${row.__rowNumber}: unsupported pushStatus "${row.pushStatus}"`);
        }

        if (row.status === "approved" && row.pushStatus !== "pending") {
            errors.push(`Row ${row.__rowNumber}: approved rows must use pushStatus=pending`);
        }

        if (row.status === "reference_only" && row.pushStatus !== "not_for_upload") {
            errors.push(`Row ${row.__rowNumber}: reference-only rows must use pushStatus=not_for_upload`);
        }

        if (row.imageRole !== "pdp-main") {
            warnings.push(`Row ${row.__rowNumber}: imageRole is "${row.imageRole}", expected "pdp-main"`);
        }

        if (!row.filename.includes(row.graceSku) || !row.filename.includes(row.websiteSku)) {
            errors.push(`Row ${row.__rowNumber}: filename does not include both SKU systems`);
        }

        if (basename(row.relativePath) !== row.filename) {
            errors.push(`Row ${row.__rowNumber}: filename does not match relativePath basename`);
        }

        const filePath = resolve(pipelineRoot, row.relativePath);
        if (!existsSync(filePath)) {
            errors.push(`Row ${row.__rowNumber}: file not found: ${filePath}`);
            continue;
        }

        const stat = statSync(filePath);
        totalBytes += stat.size;

        const expectedBytes = Number(row.bytes);
        if (stat.size !== expectedBytes) {
            errors.push(`Row ${row.__rowNumber}: bytes mismatch, manifest ${expectedBytes}, file ${stat.size}`);
        }

        const actualHash = sha256(filePath);
        if (actualHash !== row.sha256) {
            errors.push(`Row ${row.__rowNumber}: sha256 mismatch`);
        }

        const metadata = await sharp(filePath).metadata();
        if (metadata.width !== Number(row.width) || metadata.height !== Number(row.height)) {
            errors.push(
                `Row ${row.__rowNumber}: dimensions mismatch, manifest ${row.width}x${row.height}, file ${metadata.width}x${metadata.height}`,
            );
        }

        if (metadata.width !== EXPECTED_WIDTH || metadata.height !== EXPECTED_HEIGHT) {
            errors.push(
                `Row ${row.__rowNumber}: expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}, got ${metadata.width}x${metadata.height}`,
            );
        }

        files.push({
            rowNumber: row.__rowNumber,
            websiteSku: row.websiteSku,
            graceSku: row.graceSku,
            optionLabel: row.optionLabel,
            filePath,
            bytes: stat.size,
            width: metadata.width,
            height: metadata.height,
        });
    }

    return {
        rows,
        files,
        local: {
            manifestPath,
            pipelineRoot,
            rowCount: rows.length,
            productCount: products.size,
            fileCount: files.length,
            totalBytes,
            expectedDimensions: `${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`,
            approvedRows,
            referenceOnlyRows,
            uploadReady: rows.length > 0 && approvedRows === rows.length,
        },
        errors,
        warnings,
    };
}

async function shopifyGraphQL(domain, token, query, variables = {}) {
    const res = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) throw new Error(`Shopify ${res.status}: ${await res.text()}`);

    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
    return json.data;
}

async function verifyShopify(rows) {
    loadEnvLocal();

    const domain = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? "")
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");
    const token = process.env.SHOPIFY_ADMIN_TOKEN;

    if (!domain || !token) {
        return {
            checked: false,
            errors: ["Missing Shopify env vars for live verification"],
            warnings: [],
            products: [],
            variants: [],
        };
    }

    const ids = [...new Set(rows.flatMap((row) => [row.shopifyProductId, row.shopifyVariantId]))];
    const data = await shopifyGraphQL(
        domain,
        token,
        `query Nodes($ids: [ID!]!) {
          nodes(ids: $ids) {
            __typename
            ... on Product {
              id
              title
              handle
              status
            }
            ... on ProductVariant {
              id
              sku
              title
              selectedOptions { name value }
              product { id title handle }
            }
          }
        }`,
        { ids },
    );

    const nodes = new Map((data.nodes ?? []).filter(Boolean).map((node) => [node.id, node]));
    const errors = [];
    const warnings = [];
    const products = [];
    const variants = [];
    const skuMatches = {
        websiteSku: 0,
        graceSku: 0,
        neither: 0,
    };

    for (const row of rows) {
        const product = nodes.get(row.shopifyProductId);
        const variant = nodes.get(row.shopifyVariantId);

        if (!product) {
            errors.push(`Row ${row.__rowNumber}: Shopify product ID not found`);
        } else if (product.__typename !== "Product") {
            errors.push(`Row ${row.__rowNumber}: shopifyProductId is a ${product.__typename}, expected Product`);
        } else {
            products.push(product);
            if (product.handle !== row.productSlug) {
                errors.push(
                    `Row ${row.__rowNumber}: Shopify handle "${product.handle}" does not match manifest slug "${row.productSlug}"`,
                );
            }
        }

        if (!variant) {
            errors.push(`Row ${row.__rowNumber}: Shopify variant ID not found`);
        } else if (variant.__typename !== "ProductVariant") {
            errors.push(
                `Row ${row.__rowNumber}: shopifyVariantId is a ${variant.__typename}, expected ProductVariant`,
            );
        } else {
            variants.push(variant);
            if (variant.product?.id !== row.shopifyProductId) {
                errors.push(`Row ${row.__rowNumber}: variant belongs to a different Shopify product`);
            }

            if (variant.sku === row.websiteSku) {
                skuMatches.websiteSku++;
            } else if (variant.sku === row.graceSku) {
                skuMatches.graceSku++;
            } else {
                skuMatches.neither++;
                errors.push(
                    `Row ${row.__rowNumber}: Shopify SKU "${variant.sku}" does not match websiteSku or graceSku`,
                );
            }
        }
    }

    return {
        checked: true,
        storeDomain: domain,
        errors,
        warnings,
        skuMatches,
        products: [...new Map(products.map((p) => [p.id, p])).values()],
        variants: [...new Map(variants.map((v) => [v.id, v])).values()],
    };
}

function writeReport(report) {
    const reportsDir = resolve(ROOT, "pipeline/aios-shopify-pdp-images/05-push-reports");
    mkdirSync(reportsDir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const manifestName = basename(report.local.manifestPath, ".csv");
    const reportPath = resolve(reportsDir, `${stamp}-${manifestName}-dry-run.json`);
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return reportPath;
}

function printSummary(report) {
    const { local, shopify, errors, warnings, reportPath } = report;
    const mb = (local.totalBytes / 1024 / 1024).toFixed(2);

    console.log("\nAiOS Shopify PDP Image Smoke Test");
    console.log("─────────────────────────────────");
    console.log(`Manifest: ${local.manifestPath}`);
    console.log(`Rows: ${local.rowCount}`);
    console.log(`Products: ${local.productCount}`);
    console.log(`Files: ${local.fileCount}`);
    console.log(`Total PNG size: ${mb} MB`);
    console.log(`Expected dimensions: ${local.expectedDimensions}`);
    console.log(`Reference-only rows: ${local.referenceOnlyRows}`);
    console.log(`Approved upload rows: ${local.approvedRows}`);
    console.log(`Upload-ready manifest: ${local.uploadReady ? "yes" : "no"}`);

    if (shopify?.checked) {
        console.log(`Shopify read-only check: passed connection to ${shopify.storeDomain}`);
        console.log(`Shopify products resolved: ${shopify.products.length}`);
        console.log(`Shopify variants resolved: ${shopify.variants.length}`);
        console.log(
            `Shopify SKU matches: graceSku ${shopify.skuMatches?.graceSku ?? 0}, websiteSku ${shopify.skuMatches?.websiteSku ?? 0}`,
        );
    } else {
        console.log("Shopify read-only check: skipped");
    }

    console.log(`Errors: ${errors.length}`);
    console.log(`Warnings: ${warnings.length}`);
    if (reportPath) console.log(`Report: ${reportPath}`);

    if (errors.length) {
        console.log("\nErrors");
        for (const error of errors) console.log(`- ${error}`);
    }

    if (warnings.length) {
        console.log("\nWarnings");
        for (const warning of warnings) console.log(`- ${warning}`);
    }

    if (!errors.length && local.uploadReady) {
        console.log("\nResult: PASS. This manifest is upload-ready for a reviewed dry-run upload plan.");
    } else if (!errors.length) {
        console.log(
            "\nResult: PASS. This is a reference/data-mapping smoke test only, not a Shopify upload-ready manifest.",
        );
    } else {
        console.log("\nResult: FAIL. Fix errors before uploading.");
    }
}

async function main() {
    const args = parseArgs();
    const localResult = await validateLocalManifest(args.manifest);
    let shopify = { checked: false, errors: [], warnings: [], products: [], variants: [] };

    if (args.liveShopify) {
        shopify = await verifyShopify(localResult.rows);
    }

    const report = {
        mode: "dry-run",
        wroteExternalSystems: false,
        generatedAt: new Date().toISOString(),
        local: localResult.local,
        shopify,
        files: localResult.files,
        errors: [...localResult.errors, ...(shopify.errors ?? [])],
        warnings: [...localResult.warnings, ...(shopify.warnings ?? [])],
    };

    if (args.writeReport) report.reportPath = writeReport(report);
    printSummary(report);

    process.exitCode = report.errors.length ? 1 : 0;
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
