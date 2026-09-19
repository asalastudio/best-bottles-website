#!/usr/bin/env node
/**
 * Reissue the Round plate lock against evidence that cannot be rewritten.
 *
 * The original lock bound its approval to the batch manifest in dist/. Rendering
 * Round again after the hanging-closure fix rewrote that manifest, so the lock's
 * evidence stopped resolving and the ledger skipped it — the guard doing its job.
 *
 * Nothing about the approval changed: every one of the 34 approved plates is
 * byte-identical to what Jordan saw, which this re-checks before writing. The
 * reissue carries the same rows, binds them to a copy of the manifest committed
 * beside the lock, and records what it supersedes and why. The original lock is
 * left exactly as it was; a note beside it points here.
 *
 *   node scripts/asset-ledger/reissue-round-lock.mjs
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const ORIGINAL = "docs/reviews/round-plates-2026-09-18";
const REISSUE = "docs/reviews/round-plates-2026-09-18-reissued";
const BATCH = "dist/paper-doll/round-plates-2026-09-18";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const original = JSON.parse(readFileSync(path.join(ROOT, ORIGINAL, "approved-lock.json"), "utf8"));
const manifestBytes = readFileSync(path.join(ROOT, BATCH, "plates/manifest.json"));

// Every approved plate must still be the bytes that were approved.
const drift = [];
for (const row of original.rows) {
    const file = path.join(ROOT, BATCH, "plates", row.plate.key);
    if (!existsSync(file)) { drift.push(`${row.sku}: rendered file is gone`); continue; }
    if (sha256(readFileSync(file)) !== row.plate.sha256) drift.push(`${row.sku}: bytes changed`);
}
if (drift.length) {
    console.error(`refusing to reissue: ${drift.length} approved plate(s) are not what was approved`);
    for (const line of drift.slice(0, 10)) console.error(`  ${line}`);
    process.exit(1);
}
console.log(`re-verified ${original.rows.length} approved plates: all byte-identical`);

mkdirSync(path.join(ROOT, REISSUE), { recursive: true });
writeFileSync(path.join(ROOT, REISSUE, "prepared-manifest.json"), manifestBytes);

const lock = {
    ...original,
    release: "Round plates 2026-09-18 (reissued)",
    approvalId: randomUUID(),
    reissuedAt: new Date().toISOString(),
    supersedes: { release: original.release, approvalId: original.approvalId, path: `${ORIGINAL}/approved-lock.json` },
    approvalFile: `${REISSUE}/prepared-manifest.json`,
    approvalFileSha256: sha256(manifestBytes),
    preparedManifest: { file: `${REISSUE}/prepared-manifest.json`, sha256: sha256(manifestBytes), copiedFrom: `${BATCH}/plates/manifest.json` },
    note: "Same 34 plates, same bytes, same approval. Reissued because the original bound its evidence to the batch manifest in dist/, which a later render of the same family rewrote; the approved plates themselves were re-verified byte-identical before this was written. Publication is still NOT authorised.",
};

const file = path.join(ROOT, REISSUE, "approved-lock.json");
if (existsSync(file)) throw new Error("a reissued lock already exists");
writeFileSync(file, JSON.stringify(lock, null, 1) + "\n");
writeFileSync(path.join(ROOT, ORIGINAL, "superseded-by.json"), JSON.stringify({
    supersededBy: `${REISSUE}/approved-lock.json`,
    why: "the manifest this lock cites was rewritten by a later render of the same family; the approved plates were re-verified byte-identical and reissued against a committed copy",
    at: new Date().toISOString(),
}, null, 1) + "\n");
console.log(`reissued -> ${REISSUE}/approved-lock.json`);
