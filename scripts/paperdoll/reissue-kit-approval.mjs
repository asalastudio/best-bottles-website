#!/usr/bin/env node
/**
 * Re-issue a kit batch's approval against the plates that are published now.
 *
 * A kit is registered to one plate's front bytes. Every family we re-rendered
 * during the plate completion moved some of those bytes, and the publisher
 * refuses the whole batch on the first mismatch — correctly, because layering
 * a kit onto a plate it was not cut from misregisters it by exactly the pixels
 * the plate moved.
 *
 * This keeps the rows whose plate is still the approved one and sets the rest
 * aside by name, so the batch can publish what is genuinely approved while the
 * moved rows wait to be re-cut from their new plates. It records what Jordan
 * approved and when, and never widens the set: a SKU that was not a reviewed
 * candidate cannot appear here.
 *
 * With --release and --ship it prepares a first approval for a batch that has
 * none. A prepared approval is not an approval: it names no approver and carries
 * no timestamp, so the publisher's ship phrase is the only thing left, and that
 * phrase is Jordan's to give once he has seen the sheet it names.
 *
 *   node scripts/paperdoll/reissue-kit-approval.mjs \
 *     --batch dist/paper-doll/round-2026-09-16 \
 *     --against https://precise-raccoon-123.convex.cloud \
 *     --actor "Jordan · approved the kit sheet in chat 2026-09-16"
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const value = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
const batch = value("--batch");
const against = value("--against");
const actor = value("--actor");            // who approved; omitted when preparing
const release = value("--release");
const shipPhrase = value("--ship");
const sheet = value("--sheet");
if (!batch || !against) throw new Error("need --batch --against");

const plateHash = (plate) => (plate?.image ?? "").match(/\/([0-9a-f]{64})\.front-on-/)?.[1] ?? null;

async function query(name, queryArgs) {
    const res = await fetch(`${against}/api/query`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: name, args: queryArgs, format: "json" }),
    });
    const payload = await res.json();
    if (payload.status !== "success") throw new Error(payload.errorMessage ?? "query failed");
    return payload.value;
}

const manifest = JSON.parse(readFileSync(path.join(batch, "kits/manifest.json"), "utf8"));
const existing = existsSync(path.join(batch, "kits/approval.json"))
    ? JSON.parse(readFileSync(path.join(batch, "kits/approval.json"), "utf8"))
    : null;
if (!existing?.ship && !(release && shipPhrase)) {
    throw new Error("the batch has no prepared approval; pass --release and --ship to prepare one");
}
if (existing?.approvedAt && !actor) throw new Error("--actor is required when re-issuing an approval that was given");
const previous = existing ?? { release, ship: shipPhrase };

const candidates = manifest.rows.filter((row) => row.status === "candidate" && row.parts?.length);
// Re-issuing must never admit a SKU that was not already in the reviewed set.
// A batch being prepared for the first time has no such set, and is prepared,
// not approved: every extracted candidate is listed for the reviewer to judge.
const reviewed = existing?.skus ? new Set(Object.keys(existing.skus)) : new Set(candidates.map((r) => r.sku));
const skus = [...new Set(candidates.flatMap((r) => [r.websiteSku, r.graceSku].filter(Boolean)))];
const plates = {};
for (let i = 0; i < skus.length; i += 200) {
    Object.assign(plates, (await query("productPlates:forSkus", { skus: skus.slice(i, i + 200) })).plates);
}

const approved = {};
const setAside = [];
for (const row of candidates) {
    if (!reviewed.has(row.sku)) { setAside.push({ sku: row.sku, why: "not in the reviewed set" }); continue; }
    const current = plateHash(plates[row.websiteSku] ?? plates[row.graceSku]);
    if (current === null) { setAside.push({ sku: row.sku, why: "no plate published here" }); continue; }
    if (current !== row.plateSha256) {
        setAside.push({ sku: row.sku, why: "plate re-rendered since the kit was cut", approvedPlate: row.plateSha256, currentPlate: current });
        continue;
    }
    approved[row.sku] = row.plateSha256;
}

const prepared = !actor;
const out = {
    ...previous,
    approvedBy: prepared ? "PENDING — Jordan Richter" : actor,
    approvedAt: prepared ? null : new Date().toISOString(),
    preparedBy: "reissue-kit-approval.mjs (Claude Opus 5)",
    preparedAt: new Date().toISOString(),
    verifiedAgainst: against,
    reviewSheet: sheet ?? previous.reviewSheet ?? null,
    skus: approved,
    setAside,
    note: prepared
        ? "PREPARED, NOT APPROVED. Every row is an extracted candidate that passed its gates and registers to the plate published here. Publication waits on Jordan seeing the named review sheet and giving the ship phrase."
        : "Re-issued against the published plates. The set-aside rows keep their review; their kits must be re-cut from the plate that replaced the one they were registered to.",
};
writeFileSync(path.join(batch, "kits/approval.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`${path.basename(batch).padEnd(34)} ${prepared ? "prepared" : "approved"} ${Object.keys(approved).length}, set aside ${setAside.length}`);
