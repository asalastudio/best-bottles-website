#!/usr/bin/env node
/**
 * Verify one published plate release against its approval lock.
 *
 * Read-only. It answers a single question the ledger cannot answer for itself:
 * are the exact bytes Jordan approved the bytes the catalogue now serves?
 *
 * For every row in the lock it checks that the Convex index carries the plate,
 * that the indexed URL is the content-addressed key for the approved sha256,
 * and that the hosted object actually hashes to it. A cap-off view approved in
 * the lock must be indexed too. Anything that disagrees is a failure, recorded
 * by SKU; the run writes its result either way and never repairs anything.
 *
 * Only a release whose ship authorization is present and whose verification
 * comes back with zero failures may promote its rows to complete in the ledger.
 *
 *   node scripts/asset-ledger/verify-plate-release.mjs --release tulip-plate-release-2026-09-13
 *   add --limit N to spot-check, --out PATH to write elsewhere
 */
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { parseArgs } from "node:util";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";

const { values } = parseArgs({ options: { release: { type: "string" }, limit: { type: "string" }, out: { type: "string" } } });
if (!values.release) throw Error("pass --release <review directory name>");
const root = process.cwd();
const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const releaseDir = path.join(root, "docs/reviews", values.release);
const lockPath = path.join(releaseDir, "approved-lock.json");
const shipPath = path.join(releaseDir, "ship-authorization.json");
if (!existsSync(lockPath)) throw Error(`no approval lock at ${path.relative(root, lockPath)}`);
if (!existsSync(shipPath)) throw Error(`no ship authorization at ${path.relative(root, shipPath)} — a release is not verified before it is authorised`);

const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const ship = JSON.parse(readFileSync(shipPath, "utf8"));
if (ship.publicationAuthorized !== true) throw Error("ship authorization does not authorize publication");
if (ship.approvedLockSha256 && ship.approvedLockSha256 !== sha256(readFileSync(lockPath))) {
    throw Error("the approval lock changed since the ship authorization was written");
}

if (!process.env.NEXT_PUBLIC_CONVEX_URL && existsSync(path.join(root, ".env.local"))) {
    try { process.loadEnvFile(path.join(root, ".env.local")); } catch { /* checked below */ }
}
const deployment = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!deployment) throw Error("NEXT_PUBLIC_CONVEX_URL is not set");
const convex = new ConvexHttpClient(deployment);

/** Every indexed plate for the families this lock touches, by SKU. */
const families = [...new Set(lock.rows.map((r) => r.familyId).filter(Boolean))];
const indexed = new Map();
for (const familyId of families) {
    for (let cursor = null; ;) {
        const page = await convex.query(api.productPlates.byFamily, { familyId, cursor, limit: 200 });
        for (const row of page.page) indexed.set(row.sku, row);
        if (page.isDone) break;
        cursor = page.continueCursor;
    }
}

const hosted = new Map();
async function hostedHash(url) {
    if (hosted.has(url)) return hosted.get(url);
    const u = new URL(url);
    if (u.protocol !== "https:" || !u.hostname.endsWith(".public.blob.vercel-storage.com")) throw Error("plate URL is outside the recorded asset store");
    const response = await fetch(u, { signal: AbortSignal.timeout(45000), redirect: "error", cache: "no-store" });
    if (!response.ok) throw Error(`hosted object answered ${response.status}`);
    const digest = sha256(Buffer.from(await response.arrayBuffer()));
    hosted.set(url, digest);
    return digest;
}

const rows = values.limit ? lock.rows.slice(0, Number(values.limit)) : lock.rows;
const verified = [], failures = [];
let assets = 0;
for (const row of rows) {
    const sku = row.sku ?? row.websiteSku;
    const record = indexed.get(sku);
    const problems = [];
    try {
        if (!record) throw Error("no indexed plate on the deployment");
        if (row.productGroupId && record.productGroupId && row.productGroupId !== record.productGroupId) {
            problems.push("indexed row belongs to a different product group");
        }
        // The approved views, by the role the lock recorded them under.
        const want = new Map((row.views ?? []).map((v) => [v.role, v]));
        for (const [role, field] of [["on", "image"], ["off", "imageCapOff"]]) {
            const view = want.get(role);
            if (!view) continue;
            const url = record[field];
            if (!url) { problems.push(`approved ${role} view is not indexed`); continue; }
            // Keys are content-addressed, so the approved hash must be in the key…
            if (!url.includes(view.sha256)) { problems.push(`indexed ${role} view is not the approved bytes`); continue; }
            // …and the object must really hash to it.
            const digest = await hostedHash(url);
            assets++;
            if (digest !== view.sha256) problems.push(`hosted ${role} object does not hash to the approved bytes`);
        }
    } catch (err) {
        problems.push(err.message);
    }
    if (problems.length) failures.push({ sku, problems });
    else verified.push(sku);
}

const result = {
    schemaVersion: 1,
    release: lock.release,
    phase: failures.length ? "failed" : "published",
    verifiedAt: new Date().toISOString(),
    deployment,
    approvedLockSha256: sha256(readFileSync(lockPath)),
    shipAuthorizedAt: ship.authorizedAt ?? null,
    rows: rows.length,
    partial: Boolean(values.limit),
    hostedAssetsChecked: assets,
    indexedRowsChecked: rows.length,
    verifiedSkus: verified,
    failures,
};
const out = values.out ? path.resolve(root, values.out) : path.join(releaseDir, "published-verification.json");
await writeFile(out, JSON.stringify(result, null, 1) + "\n");
console.log(JSON.stringify({ release: result.release, phase: result.phase, rows: result.rows,
    hostedAssetsChecked: assets, verified: verified.length, failures: failures.length }, null, 1));
for (const f of failures.slice(0, 20)) console.error(`  FAIL ${f.sku}: ${f.problems.join("; ")}`);
if (failures.length) process.exitCode = 1;
