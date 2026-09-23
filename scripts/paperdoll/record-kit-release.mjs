#!/usr/bin/env node
/**
 * Commit the record of a kit release beside the plate locks.
 *
 * A batch lives under dist/, which is not in git, so the approval that
 * authorised a publish would otherwise leave no trace in the repository. This
 * copies the approval verbatim into docs/reviews/<dir>/ and records what was
 * published, to which deployment, and the sha256 of the review sheet that
 * stands behind it — the same discipline the plate locks follow.
 *
 *   node scripts/paperdoll/record-kit-release.mjs \
 *     --batch dist/paper-doll/round-2026-09-16 \
 *     --dir docs/reviews/round-kits-2026-09-19 \
 *     --published https://precise-raccoon-123.convex.cloud,https://helpful-elephant-638.convex.cloud
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);
const value = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
const batchRel = value("--batch");
const outRel = value("--dir");
const published = (value("--published") ?? "").split(",").filter(Boolean);
if (!batchRel || !outRel) throw new Error("need --batch --dir");

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const approvalBytes = readFileSync(path.join(ROOT, batchRel, "kits/approval.json"));
const approval = JSON.parse(approvalBytes.toString("utf8"));
const manifest = JSON.parse(readFileSync(path.join(ROOT, batchRel, "kits/manifest.json"), "utf8"));

const skus = Object.keys(approval.skus ?? {});
const candidates = manifest.rows.filter((r) => r.status === "candidate" && r.parts?.length);
const sheetRel = (approval.reviewSheet ?? "").replace(/^\//, "public/");
const dir = path.join(ROOT, outRel);
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "approval.json"), approvalBytes);

const record = {
    schemaVersion: 1,
    release: approval.release,
    batch: batchRel,
    approvedBy: approval.approvedBy,
    approvedAt: approval.approvedAt,
    shipPhrase: approval.ship,
    published,                                   // empty means prepared, not published
    counts: {
        extractedCandidates: candidates.length,
        approved: skus.length,
        setAside: (approval.setAside ?? []).length,
        notExtracted: manifest.rows.length - candidates.length,
    },
    reviewSheet: approval.reviewSheet ?? null,
    reviewSheetSha256: sheetRel && existsSync(path.join(ROOT, sheetRel)) ? sha256(readFileSync(path.join(ROOT, sheetRel))) : null,
    // The kit is only meaningful against the plate it was cut from; keeping the
    // pair is what lets a later audit prove the registration was not guessed.
    rows: skus.map((sku) => ({ sku, plateSha256: approval.skus[sku] })),
    setAside: approval.setAside ?? [],
    approvalSha256: sha256(approvalBytes),
};
writeFileSync(path.join(dir, "release.json"), JSON.stringify(record, null, 1) + "\n");
console.log(`${approval.release.padEnd(38)} ${skus.length} rows -> ${outRel}${published.length ? "" : "  (prepared, not published)"}`);
