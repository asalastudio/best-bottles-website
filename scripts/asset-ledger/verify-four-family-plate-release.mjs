#!/usr/bin/env node
// Verify one approved four-family plate release after publishing.
// This is read-only: it checks the Convex index, exact catalog identities, and
// every hosted Blob object against the immutable staged manifest.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import { retryLedgerRead, timedLedgerFetch } from "./read-retry.mjs";

const root = process.cwd();
const releaseId = "four-family-plates-2026-09-13";
const releaseDir = path.join(root, "docs/reviews", releaseId);
const manifestPath = path.join(root, "dist/paper-doll", `${releaseId}-release`, "manifest.json");

// The publisher now follows the ledger convention and loads the ignored local
// env file when callers have not already supplied the deployment URL.
if (!process.env.NEXT_PUBLIC_CONVEX_URL && existsSync(path.join(root, ".env.local"))) {
    try { process.loadEnvFile(path.join(root, ".env.local")); } catch { /* explicit check below */ }
}

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const readJson = async file => JSON.parse(await readFile(file, "utf8"));
const fail = message => { throw new Error(`verify-four-family-plate-release: ${message}`); };

const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes);
const lock = await readJson(path.join(releaseDir, "approved-lock.json"));
const preflight = await readJson(path.join(releaseDir, "release-preflight.json"));
const authorization = await readJson(path.join(releaseDir, "ship-authorization.json"));
const deployment = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!deployment) fail("NEXT_PUBLIC_CONVEX_URL is not set (load .env.local or provide it explicitly).");

assert.equal(sha256(manifestBytes), lock.manifestSha256, "manifest hash differs from approved lock");
assert.equal(manifest.publicationAuthorized, false, "staged manifest authorization changed");
assert.equal(manifest.rows.length, 637, "unexpected staged row count");
assert.equal(new Set(manifest.rows.map(row => row.websiteSku)).size, manifest.rows.length, "duplicate staged website SKU");
assert.equal(authorization.publicationAuthorized, true, "release-specific ship authorization is missing");
assert.equal(authorization.manifestSha256, lock.manifestSha256, "ship authorization is bound to a different manifest");
if (preflight.manifestSha256 !== lock.manifestSha256) fail("preflight manifest hash differs from approved lock");

const client = new ConvexHttpClient(deployment, { fetch: timedLedgerFetch });
const query = (fn, args) => retryLedgerRead(() => client.query(fn, args));

// Read every target family page and reject duplicate index rows instead of
// allowing a map overwrite to hide one.
const families = await query(api.productPlates.families, {});
const familyIds = [...new Set(manifest.rows.map(row => row.familyId))].sort();
const familySet = new Set(familyIds);
const currentRows = new Map();
const duplicateIndexRows = [];
for (const familyId of familyIds) {
    let cursor = null;
    do {
        const page = await query(api.productPlates.byFamily, { familyId, cursor, limit: 500 });
        for (const row of page.page) {
            const key = row.websiteSku ?? row.sku;
            if (currentRows.has(key)) duplicateIndexRows.push(key);
            currentRows.set(key, row);
        }
        cursor = page.isDone ? null : page.continueCursor;
    } while (cursor);
}
if (duplicateIndexRows.length) fail(`duplicate target index rows: ${duplicateIndexRows.slice(0, 10).join(", ")}`);

// Pull exact catalog identities once, rather than inferring identity from a
// filename or SKU spelling.
const products = [];
let productCursor = null;
do {
    const page = await query(api.products.getAllForPlates, { limit: 1000, cursor: productCursor });
    products.push(...page.page);
    productCursor = page.isDone ? null : page.continueCursor;
} while (productCursor);
const productsByWebsiteSku = new Map();
for (const product of products) {
    if (!product.websiteSku) continue;
    const previous = productsByWebsiteSku.get(product.websiteSku) ?? [];
    previous.push(product);
    productsByWebsiteSku.set(product.websiteSku, previous);
}

const stagedSkus = manifest.rows.flatMap(row => [row.websiteSku, row.graceSku]).filter(Boolean);
const refs = {};
const conflicts = [];
for (let i = 0; i < stagedSkus.length; i += 200) {
    const page = await query(api.productPlates.forSkus, { skus: stagedSkus.slice(i, i + 200) });
    Object.assign(refs, page.plates ?? {});
    conflicts.push(...(page.conflicts ?? []));
}
const presence = {};
for (let i = 0; i < manifest.rows.length; i += 200) {
    Object.assign(presence, await query(api.productPlates.productPresence, {
        skus: manifest.rows.slice(i, i + 200).map(row => row.websiteSku),
    }));
}
if (conflicts.length) fail(`Convex plate conflicts: ${conflicts.join(", ")}`);

const failures = [];
const assets = [];
const pushFailure = (sku, check, detail) => failures.push({ sku, check, detail });
const fetchAndCheck = async (sku, role, expected, url) => {
    if (!expected || !url) {
        pushFailure(sku, role, "missing expected asset or indexed URL");
        return;
    }
    let pathname;
    try { pathname = new URL(url).pathname; } catch { pushFailure(sku, role, "invalid indexed URL"); return; }
    if (pathname !== `/${expected.storeKey}`) pushFailure(sku, role, `indexed path ${pathname} does not match /${expected.storeKey}`);
    try {
        const response = await retryLedgerRead(() => timedLedgerFetch(url, { cache: "no-store" }));
        if (response.status !== 200) { pushFailure(sku, role, `HTTP ${response.status}`); return; }
        const contentType = (response.headers.get("content-type") ?? "").split(";", 1)[0];
        if (contentType !== "image/webp") pushFailure(sku, role, `content-type ${contentType || "missing"}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length !== expected.bytes) pushFailure(sku, role, `byte count ${bytes.length} != ${expected.bytes}`);
        if (sha256(bytes) !== expected.sha256) pushFailure(sku, role, "SHA-256 differs from staged bytes");
        const meta = await sharp(bytes).metadata();
        if (meta.width !== expected.width || meta.height !== expected.height) pushFailure(sku, role, `dimensions ${meta.width}x${meta.height} != ${expected.width}x${expected.height}`);
        assets.push({ sku, role, url, sha256: expected.sha256, bytes: bytes.length, width: meta.width, height: meta.height });
    } catch (error) {
        pushFailure(sku, role, error instanceof Error ? error.message : String(error));
    }
};

// Network checks are bounded so a transient Blob response cannot create an
// unbounded request storm while still checking every staged object.
const jobs = [];
const enqueue = (sku, role, expected, url) => jobs.push(() => fetchAndCheck(sku, role, expected, url));
for (const staged of manifest.rows) {
    const current = currentRows.get(staged.websiteSku);
    const productMatches = productsByWebsiteSku.get(staged.websiteSku) ?? [];
    if (!current) pushFailure(staged.websiteSku, "index", "no indexed row in its staged family");
    if (current && current.familyId !== staged.familyId) pushFailure(staged.websiteSku, "familyId", `${current.familyId} != ${staged.familyId}`);
    if (productMatches.length !== 1) pushFailure(staged.websiteSku, "catalog-identity", `${productMatches.length} exact website SKU products`);
    if (productMatches[0] && productMatches[0].productGroupId !== staged.productGroupId) pushFailure(staged.websiteSku, "productGroupId", `${productMatches[0].productGroupId} != ${staged.productGroupId}`);
    const found = presence[staged.websiteSku];
    if (!found || found.count !== 1) pushFailure(staged.websiteSku, "presence", `count ${found?.count ?? 0}`);
    if (found && found.graceSku !== staged.graceSku) pushFailure(staged.websiteSku, "graceSku", `${found.graceSku} != ${staged.graceSku}`);
    const indexed = current ? { image: current.image, imageCapOff: current.imageCapOff, thumb: current.thumb, thumbCapOff: current.thumbCapOff } : {};
    const aliases = [staged.websiteSku, staged.graceSku].filter(Boolean);
    for (const alias of aliases) {
        const ref = refs[alias];
        if (!ref) { pushFailure(staged.websiteSku, `lookup:${alias}`, "forSkus returned no plate reference"); continue; }
        for (const field of ["image", "imageCapOff", "thumb", "thumbCapOff"]) {
            if ((ref[field] ?? null) !== (indexed[field] ?? null)) pushFailure(staged.websiteSku, `${alias}:${field}`, "alias reference differs from indexed row");
        }
    }
    enqueue(staged.websiteSku, "front", staged.plate, indexed.image);
    enqueue(staged.websiteSku, "thumb", staged.thumb, indexed.thumb);
    if (staged.plateCapOff) enqueue(staged.websiteSku, "frontCapOff", staged.plateCapOff, indexed.imageCapOff);
    if (staged.thumbCapOff) enqueue(staged.websiteSku, "thumbCapOff", staged.thumbCapOff, indexed.thumbCapOff);
}
for (let i = 0; i < jobs.length; i += 12) await Promise.all(jobs.slice(i, i + 12).map(job => job()));

const report = {
    verifiedAt: new Date().toISOString(),
    phase: failures.length ? "failed" : "published",
    deployment,
    stagedManifest: `dist/paper-doll/${releaseId}-release/manifest.json`,
    manifestSha256: sha256(manifestBytes),
    approvedLockSha256: sha256(await readFile(path.join(releaseDir, "approved-lock.json"))),
    rows: manifest.rows.length,
    fullViewAssets: manifest.rows.reduce((count, row) => count + 1 + (row.plateCapOff ? 1 : 0), 0),
    hostedAssetsChecked: jobs.length,
    indexedRowsChecked: currentRows.size,
    verifiedSkus: manifest.rows.map(row => row.websiteSku).sort(),
    targetFamilies: familyIds,
    preservedApprovals: 147,
    recordedExceptions: 50,
    duplicateDispositionCount: 95,
    conflicts,
    failures: failures.slice(0, 200),
};
await writeFile(path.join(releaseDir, "published-verification.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ phase: report.phase, rows: report.rows, fullViewAssets: report.fullViewAssets, hostedAssetsChecked: report.hostedAssetsChecked, indexedRowsChecked: report.indexedRowsChecked, failures: failures.length, deployment }));
if (failures.length) process.exitCode = 1;
