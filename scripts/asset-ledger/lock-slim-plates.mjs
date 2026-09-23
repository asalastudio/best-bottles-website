#!/usr/bin/env node
/**
 * Lock the 37 newly built Slim plates by exact bytes.
 *
 * Jordan reviewed the contact sheet of the 37 and approved them ("yes they look
 * good"). Each row binds to the sha256 of the rendered plate, the sha256 of the
 * master PSD it came from, and the hash of the sheet he saw, so a later publish
 * can prove it is shipping the image that was approved.
 *
 * Scope: only plates production does NOT already carry. The rebuild also
 * re-rendered 86 Slim plates that are already live, 11 of which no longer match
 * what is published; none of those are in this lock, and publishing this
 * release must not touch them.
 *
 *   node scripts/asset-ledger/lock-slim-plates.mjs
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const BATCH = "dist/paper-doll/slim-2026-09-18";
const SHEET = "public/reviews/plate-completion-2026-09-18/slim-new-plates.jpg";
const PROD = "https://precise-raccoon-123.convex.cloud";
const OUT_DIR = path.join(ROOT, "docs/reviews/slim-plates-2026-09-18");

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readRoot = (rel) => readFileSync(path.join(ROOT, rel));

async function query(pathName, args) {
    const res = await fetch(`${PROD}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathName, args, format: "json" }),
    });
    const payload = await res.json();
    if (payload.status !== "success") throw new Error(payload.errorMessage ?? "query failed");
    return payload.value;
}

/** Every Slim SKU production already carries; those are out of scope here. */
async function livePlated() {
    const skus = new Set();
    for (const familyId of ["slim-30ml-clear-18-415", "slim-50ml-clear-18-415", "slim-100ml-clear-18-415"]) {
        let cursor = null;
        for (;;) {
            const page = await query("productPlates:byFamily", { familyId, cursor, limit: 500 });
            for (const row of page.page) skus.add(row.sku);
            if (page.isDone) break;
            cursor = page.continueCursor;
        }
    }
    return skus;
}

const manifestRel = `${BATCH}/plates/manifest.json`;
const manifestBytes = readRoot(manifestRel);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const live = await livePlated();

const rows = manifest.rows
    .filter((row) => row.publishable && !live.has(row.websiteSku))
    .map((row) => {
        // The rendered file must still be the bytes the manifest recorded, or the
        // lock would approve something nobody looked at.
        const rendered = readRoot(`${BATCH}/plates/${row.plate.key}`);
        if (sha256(rendered) !== row.plate.sha256) throw new Error(`${row.websiteSku}: rendered plate no longer matches the manifest`);
        return {
            sku: row.websiteSku,
            graceSku: row.graceSku,
            familyId: row.familyId,
            closure: row.closure,
            plate: { key: row.plate.key, storeKey: row.plate.storeKey, sha256: row.plate.sha256, bytes: row.plate.bytes, width: row.plate.width, height: row.plate.height },
            thumb: row.thumb ? { sha256: row.thumb.sha256, bytes: row.thumb.bytes } : null,
            source: { library: row.plate.sourceLibrary, path: row.plate.sourceRelPath, sha256: row.plate.sourceSha256 },
            capOff: row.plateCapOff ? { sha256: row.plateCapOff.sha256 } : null,
        };
    });

const lock = {
    schemaVersion: 1,
    release: "Slim plates 2026-09-18",
    approvedAt: new Date().toISOString(),
    actor: "Jordan · chat approval of the contact sheet (\"yes they look good\")",
    approvalId: randomUUID(),
    reviewPacket: SHEET,
    reviewPacketSha256: sha256(readRoot(SHEET)),
    approvalFile: manifestRel,
    approvalFileSha256: sha256(manifestBytes),
    visualApproved: true,
    legacySourcesAccepted: false,
    publicationAuthorized: false,
    indexingAuthorized: false,
    rows,
    scope: {
        renderedInBatch: manifest.rows.length,
        alreadyLiveAndExcluded: manifest.rows.filter((r) => live.has(r.websiteSku)).length,
        note: "Only plates production does not already carry are locked here.",
    },
    capOffHold: "Each of these SKUs has two different uncapped photographs filed under one name, so no cap-off view is included. The front is unambiguous; the cap-off view waits on a choice between the rivals.",
    note: "Approves the rendered plate bytes after Jordan reviewed the contact sheet. Publishing is a separate step and needs a release-specific ship phrase.",
};

mkdirSync(OUT_DIR, { recursive: true });
const file = path.join(OUT_DIR, "approved-lock.json");
if (existsSync(file)) throw new Error("a lock already exists for this release; locks are immutable");
writeFileSync(file, JSON.stringify(lock, null, 1) + "\n");
console.log(`locked ${rows.length} Slim plates -> ${path.relative(ROOT, file)}`);
console.log(`  excluded because production already carries them: ${lock.scope.alreadyLiveAndExcluded}`);
