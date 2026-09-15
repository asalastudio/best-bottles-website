#!/usr/bin/env node
/**
 * Record Jordan's source decision on the plate rows that had no candidate.
 *
 * He reviewed /reviews/legacy-hold-evidence/ on 2026-09-13 and said: "All of
 * these look perfectly fine. We approve them, and they're good to go. They're
 * all capped, but they're approved and look perfect. The only thing: the
 * aluminum bottles here, we will have to regenerate these using Higgsfield
 * GPT 2.5. All the other ones look great for what they are. Cap on."
 *
 * What this records, exactly:
 *   - The legacy photograph is ACCEPTED AS THE SOURCE for these products.
 *   - Cap-on only is accepted; no cap-off view is owed for them.
 *   - The two green-matte aluminium bottles are EXCLUDED and queued for
 *     regeneration instead.
 *
 * What it does NOT record: these rows have no indexed plate, and a legacy GIF at
 * 360x480 is not a plate on a 1000x1100 canvas. Settling the source is what was
 * blocking them; the plate still has to be prepared from that source and then
 * reviewed as new bytes. Nothing here is published, indexed, or promoted to
 * master lineage.
 *
 *   node scripts/asset-ledger/record-legacy-hold-decision.mjs [--dry-run]
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { "dry-run": { type: "boolean", default: false } } });
const root = process.cwd();
const sha256 = (b) => createHash("sha256").update(b).digest("hex");

const evidencePath = path.join(root, "data/asset-ledger/legacy-hold-evidence.json");
const evidenceBytes = await readFile(evidencePath);
const evidence = JSON.parse(evidenceBytes.toString("utf8"));
const rows = evidence.rows.filter((r) => r.recovered);

// Jordan's one exclusion, identified by the measured green matte rather than by
// name: those are the images that cannot be matted onto the plate canvas.
const regenerate = rows.filter((r) => r.background?.kind === "GREEN MATTE");
const approved = rows.filter((r) => r.background?.kind !== "GREEN MATTE");

for (const r of approved) {
    const bytes = await readFile(path.join(root, r.file));
    if (sha256(bytes) !== r.sha256) throw Error(`Evidence image changed since review: ${r.sku}`);
}

const record = {
    schemaVersion: 1,
    decision: "legacy-hold-source-acceptance-2026-09-13",
    reviewPage: "/reviews/legacy-hold-evidence/index.html",
    evidenceFile: "data/asset-ledger/legacy-hold-evidence.json",
    evidenceSha256: sha256(evidenceBytes),
    decidedAt: new Date().toISOString(),
    actor: "Jordan Richter · explicit review of the legacy hold evidence page",
    instruction: "All of these look perfectly fine. We approve them, and they're good to go. They're all capped, " +
        "but they're approved and look perfect. The only thing: the aluminum bottles here, we will have to " +
        "regenerate these using Higgsfield GPT 2.5. All the other ones look great for what they are. Cap on.",
    scope: "source acceptance only",
    sourceApproved: true,
    capOnAccepted: true,
    capOffOwed: false,
    plateApproved: false,
    indexingAuthorized: false,
    publicationAuthorized: false,
    note: "These rows have no indexed plate. The legacy photograph is accepted as their source and cap-on is " +
        "accepted as their only view. Preparing a plate from that source produces new bytes, which return for " +
        "their own review before indexing.",
    approvedRows: approved.length,
    regenerateRows: regenerate.length,
    rows: approved.map((r) => ({
        sku: r.sku, graceSku: r.graceSku, family: r.family, capacityMl: r.capacityMl,
        productGroupId: r.productGroupId, legacySku: r.legacySku, legacyUrl: r.legacyUrl,
        sourceUrl: r.sourceUrl, view: r.role, sha256: r.sha256,
        pixels: `${r.background?.width}x${r.background?.height}`,
    })),
    regenerate: regenerate.map((r) => ({
        sku: r.sku, graceSku: r.graceSku, family: r.family, capacityMl: r.capacityMl,
        productGroupId: r.productGroupId, sourceUrl: r.sourceUrl, sha256: r.sha256,
        reason: `The legacy photograph sits on a green matte (measured rgb ${r.background?.rgb?.join(",")}), so it cannot be ` +
            `matted onto the plate canvas. Jordan: regenerate with Higgsfield GPT Image 2.5.`,
        queue: "higgsfield-gpt-image-2.5",
    })),
};

if (values["dry-run"]) {
    console.log(JSON.stringify({ approvedRows: record.approvedRows, regenerateRows: record.regenerateRows,
        regenerate: record.regenerate.map((r) => r.sku) }, null, 1));
} else {
    const out = path.join(root, "data/asset-ledger/legacy-hold-source-decisions.json");
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, JSON.stringify(record, null, 1) + "\n");
    console.log(`wrote data/asset-ledger/legacy-hold-source-decisions.json`);
    console.log(`  source approved (cap-on): ${record.approvedRows}`);
    console.log(`  queued for regeneration:  ${record.regenerateRows}  ${record.regenerate.map((r) => r.sku).join(", ")}`);
}
