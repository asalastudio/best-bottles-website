#!/usr/bin/env node
/**
 * Lock the plates a family batch built that production does not already carry.
 *
 * Binds every row to the sha256 of the rendered plate, the sha256 of the PSD it
 * came from, and the hash of the contact sheet that was reviewed, so a later
 * publish can prove it is shipping the image that was approved. Plates already
 * live are excluded: a batch re-renders them, and re-rendering is not approval
 * to replace them.
 *
 * Approval is recorded, never assumed: --actor must say who approved what.
 * Publication stays unauthorised; that needs a release-specific ship phrase.
 *
 *   node scripts/asset-ledger/lock-plate-batch.mjs \
 *     --batch dist/paper-doll/round-plates-2026-09-18 \
 *     --release "Round plates 2026-09-18" \
 *     --sheet public/reviews/plate-completion-2026-09-18/round-new-plates.jpg \
 *     --dir docs/reviews/round-plates-2026-09-18 \
 *     --actor "Jordan · approved the contact sheet in chat"
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const PROD = "https://precise-raccoon-123.convex.cloud";
const args = process.argv.slice(2);
const value = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };

const batchRel = value("--batch");
const release = value("--release");
const sheetRel = value("--sheet");
const outRel = value("--dir");
const actor = value("--actor");
const note = value("--note") ?? "";
if (!batchRel || !release || !sheetRel || !outRel || !actor) throw new Error("need --batch --release --sheet --dir --actor");

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readRoot = (rel) => readFileSync(path.join(ROOT, rel));

async function query(name, queryArgs) {
    const res = await fetch(`${PROD}/api/query`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: name, args: queryArgs, format: "json" }),
    });
    const payload = await res.json();
    if (payload.status !== "success") throw new Error(payload.errorMessage ?? "query failed");
    return payload.value;
}

const manifestRel = `${batchRel}/plates/manifest.json`;
const manifestBytes = readRoot(manifestRel);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const rendered = manifest.rows.filter((row) => row.publishable && row.plate?.key);

const live = new Set();
for (const familyId of [...new Set(rendered.map((r) => r.familyId))]) {
    let cursor = null;
    for (;;) {
        const page = await query("productPlates:byFamily", { familyId, cursor, limit: 500 });
        for (const row of page.page) live.add(row.sku);
        if (page.isDone) break;
        cursor = page.continueCursor;
    }
}

const rows = rendered.filter((row) => !live.has(row.websiteSku)).map((row) => {
    const bytes = readRoot(`${batchRel}/plates/${row.plate.key}`);
    if (sha256(bytes) !== row.plate.sha256) throw new Error(`${row.websiteSku}: rendered plate no longer matches the manifest`);
    return {
        sku: row.websiteSku,
        graceSku: row.graceSku,
        familyId: row.familyId,
        closure: row.closure,
        plate: { key: row.plate.key, storeKey: row.plate.storeKey, sha256: row.plate.sha256, bytes: row.plate.bytes, width: row.plate.width, height: row.plate.height },
        thumb: row.thumb ? { sha256: row.thumb.sha256, bytes: row.thumb.bytes } : null,
        capOff: row.plateCapOff ? { sha256: row.plateCapOff.sha256 } : null,
        source: { library: row.plate.sourceLibrary, path: row.plate.sourceRelPath, sha256: row.plate.sourceSha256 },
    };
});

const policyRel = `data/paper-doll/family-policies/${manifest.rows[0]?.familyName?.split(" ")[0] ?? ""}.json`;
const lock = {
    schemaVersion: 1,
    release,
    approvedAt: new Date().toISOString(),
    actor,
    approvalId: randomUUID(),
    reviewPacket: sheetRel,
    reviewPacketSha256: sha256(readRoot(sheetRel)),
    approvalFile: manifestRel,
    approvalFileSha256: sha256(manifestBytes),
    visualApproved: true,
    legacySourcesAccepted: false,
    publicationAuthorized: false,
    indexingAuthorized: false,
    rows,
    scope: { renderedInBatch: rendered.length, alreadyLiveAndExcluded: rendered.length - rows.length },
    frontSourcePins: existsSync(path.join(ROOT, policyRel))
        ? Object.keys(JSON.parse(readFileSync(path.join(ROOT, policyRel), "utf8")).frontSourcePins ?? {})
        : [],
    note: note || "Approves the rendered plate bytes after review. Publishing is a separate step and needs a release-specific ship phrase.",
};

const dir = path.join(ROOT, outRel);
mkdirSync(dir, { recursive: true });
const file = path.join(dir, "approved-lock.json");
if (existsSync(file)) throw new Error("a lock already exists for this release; locks are immutable");
writeFileSync(file, JSON.stringify(lock, null, 1) + "\n");
console.log(`locked ${rows.length} plates -> ${path.relative(ROOT, file)}`);
console.log(`  excluded because production already carries them: ${lock.scope.alreadyLiveAndExcluded}`);
if (lock.frontSourcePins.length) console.log(`  front-source pins in force: ${lock.frontSourcePins.join(", ")}`);
