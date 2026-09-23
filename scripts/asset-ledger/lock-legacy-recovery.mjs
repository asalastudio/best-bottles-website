#!/usr/bin/env node
/**
 * Write the immutable approval lock for the 20 bottles recovered from the
 * legacy site on 2026-09-18.
 *
 * What this locks is the SOURCE images, not plates: Jordan reviewed the contact
 * sheet of what came back from bestbottles.com and said "lock them in". Each
 * row binds to the exact bytes of the recovered file, so a later plate build
 * can prove it used the image that was approved. Rendering those sources into
 * plates is a separate release and needs its own lock and ship phrase, which
 * is why publicationAuthorized and indexingAuthorized are false here.
 *
 *   node scripts/asset-ledger/lock-legacy-recovery.mjs
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const RECOVERY = "data/paper-doll/legacy-recovery-2026-09-18";
const SHEET = "public/reviews/plate-completion-2026-09-18/legacy-recovery-contact-sheet.jpg";
const OUT_DIR = path.join(ROOT, "docs/reviews/legacy-recovery-2026-09-18");

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readRoot = (rel) => readFileSync(path.join(ROOT, rel));

const manifestRel = `${RECOVERY}/manifest.json`;
const manifestBytes = readRoot(manifestRel);
const manifest = JSON.parse(manifestBytes.toString("utf8"));

const rows = manifest.rows.map((row) => {
    const rel = `${RECOVERY}/${row.file}`;
    const bytes = readRoot(rel);
    const actual = sha256(bytes);
    // The recorded hash is of the downloaded original; the staged copy must be
    // the same bytes or this lock would approve something nobody looked at.
    if (actual !== row.sha256) throw new Error(`${row.file} does not match the hash recorded at download`);
    const [width, height] = row.pixels;
    return {
        sku: row.websiteSku,
        file: rel,
        sha256: actual,
        bytes: bytes.length,
        pixels: { width, height },
        sourceUrl: row.sourceUrl,
        pageUrl: row.pageUrl,
        belowPlateCanvas: width < 1000 || height < 1100,
    };
});

const caveats = {
    everyRowIsBelowThePlateCanvas: "all 20 are smaller than 1000x1100, so each becomes a legacy-source plate",
    softSources: rows.filter((r) => r.pixels.width < 600).map((r) => r.sku),
    greenBackdrop: ["Alu100mlSprayBlack", "Alu500"],
    catalogueQuestions: [
        "legacy calls the Pillar bottles 9 ml while their URLs say 5 ml",
        "Bell sells as 10 ml but the PSD libraries only hold Bell 12 ml",
    ],
};

const lock = {
    schemaVersion: 1,
    release: "Legacy source recovery 2026-09-18",
    approvedAt: new Date().toISOString(),
    actor: "Jordan · chat approval after reviewing the contact sheet (\"great lock them in\")",
    approvalId: randomUUID(),
    reviewPacketSha256: sha256(readRoot(SHEET)),
    reviewPacket: SHEET,
    approvalFile: manifestRel,
    approvalFileSha256: sha256(manifestBytes),
    visualApproved: true,
    legacySourcesAccepted: true,
    publicationAuthorized: false,
    indexingAuthorized: false,
    rows,
    caveats,
    note: "Approves the recovered SOURCE images by exact bytes, after Jordan reviewed the contact sheet. These 20 bottles have no artwork in the master, BBUAT or original Photoshop libraries under any spelling; bestbottles.com is the client's own site and the lane's completeness authority. Building these into plates, and publishing them, are separate steps that need their own lock and release-specific ship phrase.",
};

mkdirSync(OUT_DIR, { recursive: true });
const file = path.join(OUT_DIR, "approved-lock.json");
if (existsSync(file)) throw new Error("a lock already exists for this release; locks are immutable");
writeFileSync(file, JSON.stringify(lock, null, 1) + "\n");
console.log(`locked ${rows.length} recovered sources -> ${path.relative(ROOT, file)}`);
console.log(`  soft (<600px wide): ${caveats.softSources.length ? caveats.softSources.join(", ") : "none"}`);
console.log(`  green backdrop: ${caveats.greenBackdrop.join(", ")}`);
