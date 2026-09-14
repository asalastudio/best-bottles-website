#!/usr/bin/env node
/**
 * Lock Jordan's approval of the prepared missing-plate candidates.
 *
 * 2026-09-13: "All the candidates that are actually prepared, let's just go with
 * that. They're all fine. All the candidates are prepared, and all the plates are
 * prepared, including the divas."
 *
 * That covers every candidate in the 223-row acquisition packet that has a
 * prepared image, both the 67 marked ready for review and the 7 held behind an
 * earlier reconciliation finding (the Divas among them).
 *
 * Each candidate was built from its exact master PSD onto the 1000x1100 plate
 * canvas. This records visual approval of those exact bytes and nothing else:
 * publication and indexing stay unauthorised, so the rows read as "approved,
 * awaiting release" until their named release is published and verified.
 *
 * Every image is re-hashed against the packet before the lock is written; a
 * candidate whose bytes moved since it was prepared is refused, not approved.
 *
 *   node scripts/asset-ledger/lock-acquisition-candidates.mjs [--dry-run]
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { "dry-run": { type: "boolean", default: false } } });
const root = process.cwd();
const sha256 = (b) => createHash("sha256").update(b).digest("hex");

const packetPath = path.join(root, "data/asset-ledger/missing-plate-acquisition-2026-09-13.json");
const packetBytes = await readFile(packetPath);
const packet = JSON.parse(packetBytes.toString("utf8"));

const candidates = packet.rows.filter((r) => r.candidate);
const rows = [], refused = [];
for (const r of candidates) {
    const bytes = await readFile(path.join(root, r.candidate.path));
    if (sha256(bytes) !== r.candidate.sha256) { refused.push({ sku: r.sku, reason: "candidate bytes changed since preparation" }); continue; }
    const source = r.source ?? null;
    if (!source?.path || source.library !== "master") { refused.push({ sku: r.sku, reason: "candidate is not backed by a master PSD source" }); continue; }
    rows.push({
        sku: r.sku, graceSku: r.graceSku ?? null, family: r.family, capacityMl: r.capacityMl ?? null,
        color: r.color ?? null, applicator: r.applicator ?? null, capColor: r.capColor ?? null,
        productGroupId: r.productGroupId ?? null,
        status: r.status,
        views: [{ role: "on", sha256: r.candidate.sha256, url: r.candidate.url, path: r.candidate.path }],
        source: { library: source.library, path: source.path, sha256: source.sha256 ?? null,
            stateEvidence: source.stateEvidence ?? null },
        binding: sha256(JSON.stringify({ sku: r.sku, group: r.productGroupId ?? null, sha: r.candidate.sha256 })),
    });
}

const lock = {
    schemaVersion: 1,
    release: "missing-plate-acquisition-2026-09-13",
    approvedAt: new Date().toISOString(),
    actor: "Jordan Richter · explicit batch approval of the prepared candidates",
    instruction: "All the candidates that are actually prepared, let's just go with that. They're all fine. " +
        "All the candidates are prepared, and all the plates are prepared, including the divas.",
    reviewPage: "/reviews/missing-plate-acquisition-2026-09-13/index.html",
    approvalFile: "data/asset-ledger/missing-plate-acquisition-2026-09-13.json",
    approvalFileSha256: sha256(packetBytes),
    canvas: { width: 1000, height: 1100 },
    visualApproved: true,
    publicationAuthorized: false,
    indexingAuthorized: false,
    approvedRows: rows.length,
    heldRows: refused,
    note: "Visual approval of these exact prepared bytes, each built from its master PSD onto the plate canvas. " +
        "Publication and indexing remain separate and unauthorised. Rows read as approved and awaiting release " +
        "until the named release is published and its hosted views verified.",
    rows,
};

if (values["dry-run"]) {
    console.log(JSON.stringify({ approved: rows.length, refused }, null, 1));
} else {
    const dir = path.join(root, "docs/reviews/missing-plate-acquisition-2026-09-13");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "approved-lock.json"), JSON.stringify(lock, null, 1) + "\n");
    console.log(`wrote docs/reviews/missing-plate-acquisition-2026-09-13/approved-lock.json`);
    console.log(`  approved: ${rows.length}`);
    console.log(`  refused:  ${refused.length}${refused.length ? " -> " + refused.map((r) => r.sku).join(", ") : ""}`);
    const byFamily = rows.reduce((m, r) => m.set(r.family, (m.get(r.family) ?? 0) + 1), new Map());
    console.log("  " + [...byFamily].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(", "));
}
