#!/usr/bin/env node
/**
 * Record Jordan's family-level batch approval of EXISTING indexed plates.
 *
 * On 2026-09-13 he instructed: "The royal, the reducers, everything that has
 * already been here that's been qualified and is awaiting review, we are
 * approving it now, shipping it, and signing off on it."
 *
 * These rows reuse plates that are already indexed and already serving. The
 * approval records sign-off on the bytes that are live today; it publishes
 * nothing and changes no pixel. Every row still goes through savePlateBatch,
 * which refuses the batch if the sheet is stale, a binding changed, a row is
 * ineligible, the live views moved, or a served byte no longer hashes to what
 * was reviewed. Ineligible rows are reported and left alone.
 *
 *   node scripts/asset-ledger/approve-family-sheets.mjs --family "Royal" [...]
 *   node scripts/asset-ledger/approve-family-sheets.mjs --all-awaiting
 *   add --dry-run to report what would be approved without saving
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { readPlateSheet, savePlateBatch } from "./plate-contact-sheet.mjs";

const { values } = parseArgs({
    options: { family: { type: "string", multiple: true, default: [] }, "all-awaiting": { type: "boolean", default: false },
        "dry-run": { type: "boolean", default: false } },
});
const root = process.cwd();
const NOTE = "Family batch approval of the existing indexed plate. Jordan, 2026-09-13: everything already here, " +
    "qualified and awaiting review is approved and signed off. Cap-on where that is the only served view.";

const ledger = JSON.parse(await readFile(path.join(root, "src/lib/asset-ledger/ledger.json"), "utf8"));
let families = values.family;
if (values["all-awaiting"]) {
    families = ledger.platePlan.families.filter((f) => f.review > 0).sort((a, b) => b.review - a.review).map((f) => f.family);
}
if (!families.length) throw Error("Name at least one family, or pass --all-awaiting.");

const awaiting = new Map();
for (const row of ledger.platePlan.rows) {
    if (row.stage !== "review") continue;
    if (!awaiting.has(row.family)) awaiting.set(row.family, new Set());
    awaiting.get(row.family).add(row.sku);
}

let approvedTotal = 0, skippedTotal = 0;
for (const family of families) {
    const sheet = await readPlateSheet(root, family);
    if (!sheet) { console.log(`${family.padEnd(18)} no contact sheet - prepare one first`); continue; }
    const wanted = awaiting.get(family) ?? new Set();
    // Only rows the plan says are awaiting review, and only those the sheet itself
    // considers eligible. Everything else keeps its current state untouched.
    const eligible = sheet.rows.filter((r) => wanted.has(r.sku) && r.eligible);
    const ineligible = sheet.rows.filter((r) => wanted.has(r.sku) && !r.eligible);
    if (!eligible.length) {
        console.log(`${family.padEnd(18)} awaiting=${wanted.size}  eligible=0  (nothing to record)`);
        skippedTotal += ineligible.length;
        continue;
    }
    if (values["dry-run"]) {
        console.log(`${family.padEnd(18)} would approve ${eligible.length}, skip ${ineligible.length} ineligible`);
        approvedTotal += eligible.length; skippedTotal += ineligible.length;
        continue;
    }
    const input = { family, token: sheet.token, revision: sheet.revision,
        decisions: eligible.map((r) => ({ sku: r.sku, binding: r.binding, status: "approved", notes: NOTE })) };
    try {
        await savePlateBatch(root, input);
        console.log(`${family.padEnd(18)} approved ${String(eligible.length).padStart(3)}   skipped ${ineligible.length} ineligible`);
        approvedTotal += eligible.length; skippedTotal += ineligible.length;
    } catch (err) {
        console.log(`${family.padEnd(18)} REFUSED: ${err.message}`);
    }
}
console.log(`\n${values["dry-run"] ? "would approve" : "approved"} ${approvedTotal} existing plates; ${skippedTotal} rows left untouched as ineligible.`);
