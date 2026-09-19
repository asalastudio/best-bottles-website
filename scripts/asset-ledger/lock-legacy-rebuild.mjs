#!/usr/bin/env node
/**
 * Lock Jordan's visual approval of the plates rebuilt from the master PSDs.
 *
 * He reviewed /reviews/legacy-rebuild-2026-09-13/ on 2026-09-14, after the
 * tassel framing was corrected, and approved the set.
 *
 * The lock is built from the render manifests, which are authoritative, and
 * every row is cross-checked against the copy the review page actually
 * displayed. A plate whose bytes differ from what was on screen is refused,
 * not approved: the approval has to bind to the thing he looked at.
 *
 * Rows that came out byte-identical to the plate already served are recorded
 * separately — approving them is real, but publishing them changes nothing.
 *
 *   node scripts/asset-ledger/lock-legacy-rebuild.mjs [--dry-run]
 *
 * Writes docs/reviews/legacy-rebuild-2026-09-13/approved-lock.json. Publishes
 * nothing; publication is a separate, separately authorised step.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { glob } from "node:fs/promises";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { "dry-run": { type: "boolean", default: false } } });
const root = process.cwd();
const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const RELEASE = "legacy-rebuild-2026-09-13";

// Rows already complete need neither approval nor publication: their bytes are
// what the catalogue serves and they carry a finished release of their own.
const ledger = JSON.parse(await readFile(path.join(root, "src/lib/asset-ledger/ledger.json"), "utf8"));
const stageBySku = new Map(ledger.platePlan.rows.map((r) => [r.sku, r.stage]));

const reviewPath = path.join(root, "data/asset-ledger/legacy-rebuild-review.json");
const reviewBytes = await readFile(reviewPath);
const review = JSON.parse(reviewBytes.toString("utf8"));
const shown = new Map(review.rows.map((r) => [r.sku, r]));

// Every rebuild batch, newest render of a family winning, exactly as the page reads them.
const manifests = [];
for (const base of ["dist/paper-doll/legacy-rebuild-2026-09-13", "dist/paper-doll/technical-reconciliation-2026-09-13"]) {
    for await (const m of glob(`${base}/*/plates/manifest.json`)) manifests.push(m);
}
const byFamilyDir = new Map();
for (const m of manifests.sort()) {
    const family = path.basename(path.dirname(path.dirname(m)));
    if (m.includes("legacy-rebuild-2026-09-13") || !byFamilyDir.has(family)) byFamilyDir.set(family, m);
}

const rows = [], refused = [], unchanged = [], alreadyComplete = [];
for (const [batch, manifestPath] of [...byFamilyDir].sort()) {
    const manifestBytes = await readFile(manifestPath);
    const manifest = JSON.parse(manifestBytes.toString("utf8"));
    const dir = path.dirname(manifestPath);
    for (const r of manifest.rows) {
        if (!r.publishable) continue;
        const sku = r.websiteSku;
        const onBytes = await readFile(path.join(dir, r.plate.key));
        const onSha = sha256(onBytes);
        if (onSha !== r.plate.sha256) { refused.push({ sku, reason: "plate bytes disagree with the manifest" }); continue; }
        const card = shown.get(sku);
        if (!card) { refused.push({ sku, reason: "not present on the reviewed sheet" }); continue; }
        if (stageBySku.get(sku) === "complete") { alreadyComplete.push(sku); continue; }
        if (card.afterSha !== onSha) { refused.push({ sku, reason: "the sheet displayed different bytes than the current render" }); continue; }
        const views = [{ role: "on", sha256: onSha, bytes: onBytes.length, key: r.plate.storeKey }];
        if (r.plateCapOff) {
            const offBytes = await readFile(path.join(dir, r.plateCapOff.key));
            views.push({ role: "off", sha256: sha256(offBytes), bytes: offBytes.length, key: r.plateCapOff.storeKey });
        }
        const entry = {
            sku, graceSku: r.graceSku ?? null, familyId: r.familyId, batch,
            source: { library: r.plate.sourceLibrary, path: r.plate.sourceRelPath, sha256: r.plate.sourceSha256 ?? null },
            views,
            replacesServed: Boolean(card.beforeUrl) && !card.identical,
            identicalToServed: Boolean(card.identical),
            binding: sha256(JSON.stringify({ sku, views: views.map((v) => v.sha256) })),
        };
        if (entry.identicalToServed) unchanged.push(sku);
        rows.push(entry);
    }
}

const lock = {
    schemaVersion: 1,
    release: RELEASE,
    approvedAt: new Date().toISOString(),
    actor: "Jordan Richter · review of /reviews/legacy-rebuild-2026-09-13/",
    instruction: "lock the approval and publish",
    reviewPage: "/reviews/legacy-rebuild-2026-09-13/index.html",
    approvalFile: "data/asset-ledger/legacy-rebuild-review.json",
    approvalFileSha256: sha256(reviewBytes),
    canvas: { width: 1000, height: 1100 },
    visualApproved: true,
    publicationAuthorized: false,
    indexingAuthorized: false,
    approvedRows: rows.length,
    heldRows: refused,
    note: "Plates rebuilt from the master PSD library, every row from library 'master'. Tassel groups carry the " +
        "framing rule chosen 2026-09-13: frame taken from a sibling group of the same glass, size kept so bulb and " +
        "tassel stay uncropped, foot pinned to the sibling baseline. Publication and indexing remain separate.",
    counts: {
        approved: rows.length,
        replacesServed: rows.filter((r) => r.replacesServed).length,
        identicalToServed: unchanged.length,
        newPlate: rows.filter((r) => !r.replacesServed && !r.identicalToServed).length,
        refused: refused.length,
        skippedAlreadyComplete: alreadyComplete.length,
    },
    rows,
};

if (values["dry-run"]) {
    console.log(JSON.stringify({ ...lock.counts, batches: [...byFamilyDir.keys()] }, null, 1));
    for (const r of refused.slice(0, 10)) console.error(`  REFUSED ${r.sku}: ${r.reason}`);
} else {
    const dir = path.join(root, "docs/reviews", RELEASE);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "approved-lock.json"), JSON.stringify(lock, null, 1) + "\n");
    console.log(`wrote docs/reviews/${RELEASE}/approved-lock.json`);
    console.log(JSON.stringify(lock.counts, null, 1));
    for (const r of refused.slice(0, 10)) console.error(`  REFUSED ${r.sku}: ${r.reason}`);
}
