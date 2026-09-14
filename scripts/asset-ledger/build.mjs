#!/usr/bin/env node
import {readCylinderFinalRelease,applyCylinderFinalRelease} from './cylinder-final-release.mjs';
import {readCompletion} from './plate-completion.mjs';
import {readSourceRecovery} from './source-recovery.mjs';
import {applyPlateSheetReviews} from './plate-contact-sheet.mjs';
import {applyPreparedPlateReviews} from './prepared-plate-reviews.mjs';
import {buildPlatePlan} from './plate-plan.mjs';
import {readPlateReleaseLocks} from './plate-release-locks.mjs';
import {assembledPlatePresentation} from './plate-presentation.mjs';
import {applyPlateScope} from './plate-scope.mjs';
import {readCylinderFinalPlates,applyCylinderFinalPreparation} from './cylinder-final-plates.mjs';
import {retryLedgerRead,timedLedgerFetch} from './read-retry.mjs';
/**
 * Asset ledger: one row per product SKU with the state of each visual asset kind
 * (hero, plate, kit), joined from every store that holds part of the truth.
 *
 *   node scripts/asset-ledger/build.mjs            -> src/lib/asset-ledger/ledger.json (read by /lab/asset-ledger)
 *
 * Stores read (nothing is written to any of them):
 *   Convex (NEXT_PUBLIC_CONVEX_URL): products, productGroups, productPlates, productKits (forSku + integrity)
 *   Hero registry + release manifest + release approved-locks + the files under public/images/catalog/bone-review
 *   Review library collections (feedback.json decisions) from every root in ASSET_LEDGER_REVIEW_ROOTS
 *   Kit completion ledger csv, kit candidate / remediation addenda, plate hold list
 *
 * Optional env:
 *   ASSET_LEDGER_REVIEW_ROOTS  colon-separated hero-reviews roots (defaults below)
 *   ASSET_LEDGER_HERO_LOCK     path to a working approved-lock.json not yet committed to a release
 *   ASSET_LEDGER_SKIP_CONVEX=1 build from local files only (plate/kit states become "unknown")
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, realpathSync, renameSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import { readReviews } from "./reviews.mjs";
const root = process.cwd();
// `npm run ledger:build` should just work: pick up NEXT_PUBLIC_CONVEX_URL from .env.local without sourcing it first
if (!process.env.NEXT_PUBLIC_CONVEX_URL && existsSync(path.join(root, ".env.local"))) { try { process.loadEnvFile(path.join(root, ".env.local")); } catch { /* fall through to the explicit error below */ } }
const gitCommon = execSync("git rev-parse --git-common-dir", { cwd: root }).toString().trim();
const mainCheckout = path.resolve(root, gitCommon, "..");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const sources = [];
const note = (name, detail) => sources.push({ name, ...detail });

// ---------- product identity (Convex) ----------
let products = [], groups = [], deployment = null;
const skipConvex = process.env.ASSET_LEDGER_SKIP_CONVEX === "1";
let convex = null, api = null;
if (!skipConvex) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) { console.error("NEXT_PUBLIC_CONVEX_URL is not set (source .env.local) — or ASSET_LEDGER_SKIP_CONVEX=1"); process.exit(1); }
    const { ConvexHttpClient } = await import("convex/browser");
    ({ api } = await import("../../convex/_generated/api.js"));
    const client = new ConvexHttpClient(url, {fetch:timedLedgerFetch});
    convex = {query:(...args)=>retryLedgerRead(()=>client.query(...args))};
    deployment = url.replace(/^https?:\/\//, "").replace(/\.convex\.cloud$/, "");
    const page = async (fn, args, key) => { const out = []; let cursor = null; for (;;) { const r = await convex.query(fn, { ...args, cursor }); out.push(...(r.page ?? r.rows ?? r[key] ?? [])); if (r.isDone) break; cursor = r.continueCursor; } return out; };
    products = await page(api.products.getAllForPlates, { limit: 500 });
    { const g = await convex.query(api.products.getAllGroupsForPlates, {}); groups = Array.isArray(g) ? g : (g.page ?? g.rows ?? []); }
    note("convex.products", { deployment, rows: products.length });
    note("convex.productGroups", { deployment, rows: groups.length });
}
const groupById = new Map(groups.map((g) => [g._id, g]));

// ---------- heroes ----------
const registry = readJson(path.join(root, "src/lib/products/catalog-heroes.json"));
const manifest = readJson(path.join(root, "docs/reviews/catalog-complete-hero-release-2026-09-07.json"));
const manifestBySku = new Map(manifest.rows.map((r) => [r.websiteSku, r]));
note("hero.registry", { path: "src/lib/products/catalog-heroes.json", rows: registry.length });
note("hero.manifest", { path: "docs/reviews/catalog-complete-hero-release-2026-09-07.json", rows: manifest.rows.length });
const heroLocks = new Map(); // sku -> {sha256, release}
for (const dir of readdirSync(path.join(root, "docs/reviews")).filter((d) => /^sunburst-heroes-release-\d+$/.test(d)).sort((a,b)=>Number(a.match(/\d+$/)[0])-Number(b.match(/\d+$/)[0]))) {
    const p = path.join(root, "docs/reviews", dir, "approved-lock.json");
    if (!existsSync(p)) continue;
    const lock = readJson(p); for (const [sku, e] of Object.entries(lock)) heroLocks.set(sku, { sha256: e.sha256, release: dir.replace("sunburst-heroes-", "") });
    note("hero.lock", { path: `docs/reviews/${dir}/approved-lock.json`, rows: Object.keys(lock).length });
}
if (process.env.ASSET_LEDGER_HERO_LOCK && existsSync(process.env.ASSET_LEDGER_HERO_LOCK)) {
    const lock = readJson(process.env.ASSET_LEDGER_HERO_LOCK); let n = 0;
    for (const [sku, e] of Object.entries(lock)) { const prior = heroLocks.get(sku); if (!prior || prior.sha256 !== e.sha256) { heroLocks.set(sku, { sha256: e.sha256, release: "working-lock" }); n++; } }
    note("hero.lock", { path: process.env.ASSET_LEDGER_HERO_LOCK, rows: Object.keys(lock).length, newerThanReleases: n });
}

// ---------- review library ----------
const defaultRoots = [
    path.join(root, "hero-reviews"),
    path.join(mainCheckout, "hero-reviews"),
    path.join(mainCheckout, ".worktrees/priority-family-kits/hero-reviews"),
    "/Users/jordanrichter/.codex/visualizations/2026/09/09/01a083e8-52fb-7dc3-bb73-4af44d38cf7f/plates-kits-heroes-handoff/hero-reviews",
];
const roots = (process.env.ASSET_LEDGER_REVIEW_ROOTS ? process.env.ASSET_LEDGER_REVIEW_ROOTS.split(":") : defaultRoots).filter((r) => existsSync(r));
const {review, audit: reviewAudit, unmatchedSkus} = readReviews(roots, readJson(path.join(root, "data/asset-ledger/review-collections.json")).collections);
for (const entry of reviewAudit.roots) note("review.root", entry);

// ---------- plates + kits (Convex) ----------
const plates = new Map(); const kitsLive = new Map(); const kitIssues = new Map(); const plateIssues = new Map(); let plateFamilies = [];
if (convex) {
    plateFamilies = await convex.query(api.productPlates.families, {});
    for (const fam of plateFamilies) { let cursor = null; for (;;) { const r = await convex.query(api.productPlates.byFamily, { familyId: fam.familyId, cursor, limit: 500 }); for (const p of r.page) plates.set(p.websiteSku ?? p.sku, { ...p, familyId: fam.familyId }); if (r.isDone) break; cursor = r.continueCursor; } }
    note("convex.productPlates", { deployment, families: plateFamilies.length, rows: plates.size });
    const sweep = async (fn, into) => { let cursor = null, checked = 0; for (;;) { const r = await convex.query(fn, { cursor, pageSize: 200 }); checked += r.checked; for (const i of r.issues) into.set(i.sku, [...(into.get(i.sku) ?? []), `${i.issue}${i.detail ? " " + i.detail : ""}`]); if (r.isDone) break; cursor = r.continueCursor; } return checked; };
    const pc = await sweep(api.productPlates.integrity, plateIssues); const kc = await sweep(api.productKits.integrity, kitIssues);
    note("convex.integrity", { deployment, platesChecked: pc, kitsChecked: kc, plateIssues: plateIssues.size, kitIssues: kitIssues.size });
    // Read the complete index in small batches; no kit preparation or mutation.
    // A transient timeout must be retried, never treated as a missing kit.
    const plated = [...plates.keys()]; let done = 0;
    for (let i = 0; i < plated.length; i += 6) {
        await Promise.all(plated.slice(i, i + 6).map(async (sku) => { const k = await convex.query(api.productKits.forSku, { websiteSku: sku, graceSku: plates.get(sku)?.graceSku ?? null }); if (k) kitsLive.set(sku, { completeness: k.completeness, plateSha256: k.plateSha256, parts: k.parts?.length ?? 0 }); }));
        const previous=done;done=Math.min(i+6,plated.length);
        if(Math.floor(done/250)>Math.floor(previous/250)||done===plated.length)console.error(`kits ${done}/${plated.length}`);
    }
    note("convex.productKits", { deployment, live: kitsLive.size, askedFor: plated.length });
}

// ---------- plate geometry: existence is not correctness ----------
// scripts/asset-ledger/measure-plates.py measures every served plate; a plate whose glass is
// the wrong width for its bottle, or that was built from a legacy website GIF, must not count as done.
const geomPath = path.join(root, "src/lib/asset-ledger/plate-geometry.json");
const geom = existsSync(geomPath) ? readJson(geomPath) : null;
if (geom) note("plate.geometry", { path: "src/lib/asset-ledger/plate-geometry.json", generatedAt: geom.generatedAt, ...geom.summary });
// Product kinds that never take a plate: they are not bottles.
const NO_PLATE_CATEGORY = new Set(["Component", "Packaging", "Accessory", "Gift Bag", "Gift Box"]);

// ---------- local kit + plate ledgers ----------
const kitCsv = new Map();
const csvPath = process.env.ASSET_LEDGER_KIT_LEDGER ?? path.join(root, "docs/reviews/catalog-kit-completion-2026-09-08/kit-completion-ledger.csv");
if (existsSync(csvPath)) {
    const [head, ...lines] = readFileSync(csvPath, "utf8").trim().split("\n"); const cols = head.split(",");
    for (const line of lines) { const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')); const rec = Object.fromEntries(cols.map((c, i) => [c, cells[i]])); kitCsv.set(rec.websiteSku, rec); }
    note("kit.completionLedger", { path: path.relative(root,csvPath), rows: kitCsv.size });
}
const historicalSizeHolds = new Map(readJson(path.join(root,"data/asset-ledger/unresolved-size-findings.json")).rows.filter(r=>r.status === "open").map(r=>[r.sku,r]));
// Boston kit approvals are kept separate from generic review cards. They are
// accepted only when the approval's plate SHA still matches the current plate;
// a re-render therefore returns to review instead of inheriting approval.
const bostonKitReleasePath = path.join(root, "dist/paper-doll/boston-kit-release-2026-09-12/manifest.json");
const bostonKitRelease = existsSync(bostonKitReleasePath) ? readJson(bostonKitReleasePath) : null;
const bostonKitApprovals = new Map((bostonKitRelease?.rows ?? []).filter(r => r.approval?.status === "approved").map(r => [r.sku, r]));
if (bostonKitRelease) note("boston.kit-release", { path: path.relative(root, bostonKitReleasePath), rows: bostonKitRelease.rows.length, approved: bostonKitApprovals.size, publicationAuthorized: !!bostonKitRelease.publicationAuthorized });
const plateHolds = new Map();
const holdPath = path.join(root, "data/paper-doll/priority-family-kit-holds-2026-09-08.json");
if (existsSync(holdPath)) { for (const r of readJson(holdPath).rows) plateHolds.set(r.websiteSku, r); note("plate.holds", { path: "data/paper-doll/priority-family-kit-holds-2026-09-08.json", rows: plateHolds.size }); }

// ---------- join ----------
const skus = new Set([...products.map((p) => p.websiteSku).filter(Boolean), ...registry.map((r) => r.websiteSku), ...plates.keys(), ...review.hero.keys(), ...review.plate.keys(), ...review.kit.keys(), ...kitCsv.keys(), ...unmatchedSkus]);
const registryBySku = new Map(registry.map((r) => [r.websiteSku, r]));
const productBySku = new Map(products.map((p) => [p.websiteSku, p]));
const localPlateEvidence = readJson(path.join(root,"data/asset-ledger/local-plate-evidence.json"));
const localCandidates = new Map(localPlateEvidence.candidates.map(r=>[r.sku,r]));
const sourceHolds = new Map(localPlateEvidence.holds.map(r=>[r.sku,r]));
const rows = [];
for (const sku of [...skus].sort()) {
    const p = productBySku.get(sku); const reg = registryBySku.get(sku); const man = manifestBySku.get(sku); const lock = heroLocks.get(sku); const rv = review.hero.get(sku); const kv = review.kit.get(sku);
    const g = p ? groupById.get(p.productGroupId) : null;
    const family = p?.family ?? reg?.family ?? kitCsv.get(sku)?.family ?? "Unknown";
    // hero
    let hero;
    if (reg) {
        const file = path.join(root, "public", reg.url); const onDisk = existsSync(file);
        const fileSha = onDisk ? sha256(readFileSync(file)) : null;
        const approvedSha = lock?.sha256; const generation = approvedSha && approvedSha === fileSha ? "sunburst-approved" : lock ? "stale" : "prior-release";
        hero = { state: !onDisk ? "indexed-missing-file" : generation === "stale" ? "indexed-stale" : "indexed", generation, url: reg.url, sha256: fileSha, manifestSha256: man?.sha256, lock: lock?.release, groupSlug: reg.groupSlug };
        if (fileSha && man && fileSha !== man.sha256) hero.state = "indexed-manifest-mismatch";
    } else if (lock) hero = { state: rv && rv.sha256 !== lock.sha256 ? rv.status : "approved-not-indexed", sha256: lock.sha256, lock: lock.release, why: "no registry row for this product yet" };
    else if (rv?.decision) hero = { state: rv.decision.status === "approved" ? "approved-not-locked" : rv.decision.status, review: rv.decision };
    else if (rv) hero = { state: rv.status, collections: rv.collections.length };
    else hero = { state: "none" };
    if (rv?.decision && !hero.review) hero.review = rv.decision;
    if (rv) hero.candidate = { state: rv.status, sha256: rv.sha256, collection: rv.collection, bytesVerified: rv.bytesVerified };
    // plate
    let plate;
    const pl = plates.get(sku);
    const pgm = geom?.plates?.[sku];
    const twoPiece = assembledPlatePresentation({sku,applicator:p?.applicator});
    if (NO_PLATE_CATEGORY.has(p?.category ?? "")) plate = { state: "not-applicable", reason: `${p.category}: not a bottle` };
    else if (pl) {
        const hasCapOff = !!(pl.imageCapOff || pl.views?.some?.((v) => v.cap === "off"));
        let state;
        if (!pgm || pgm.imageUrl !== pl.image || !pgm.imageSha256 || !pgm.bytesVerified) state = "measurement-stale";
        else if (plateIssues.has(sku)) state = "integrity-hold";
        else if (pgm?.wrongSize) state = "plated-wrong-size";
        else if (pgm?.legacySource) state = "plated-legacy-source";
        else if (twoPiece) state = "plated-no-capoff-by-design";
        else if (hasCapOff) state = "plated";
        else state = "plated-cap-on-only";
        plate = { state, familyId: pl.familyId, sha256: pgm?.imageSha256 ?? null, revision: pl.revision,
                  imageUrl: pl.image, sourcePath: pl.sourcePath, capOff: hasCapOff, issues: plateIssues.get(sku),
                  ...(pgm ? { bodyWidth: pgm.bodyWidth, expectedWidth: pgm.expectedWidth, sizeDeviation: pgm.sizeDeviation, legacySource: pgm.legacySource } : {}) };
    }
    else if (plateHolds.has(sku)) plate = { state: "hold", hold: plateHolds.get(sku).holdType, reason: plateHolds.get(sku).reason };
    else if (NO_PLATE_CATEGORY.has(p?.category ?? "")) plate = { state: "not-applicable", reason: `${p.category}: not a bottle` };
    else plate = { state: convex ? "none" : "unknown" };
    if (pl && plateHolds.has(sku)) { plate.hold = plateHolds.get(sku).holdType; plate.reason = plateHolds.get(sku).reason; }
    const pv = review.plate.get(sku);
    if (pv) plate.candidate = {state:pv.status, sha256:pv.sha256, collection:pv.collection, bytesVerified:pv.bytesVerified};
    // A historical plate approval is visible evidence, never a hero approval.
    plate.approval = pv?.decision?.status === "approved" && pv.decision.sha256 === plate.sha256 ? pv.decision : null;
    if (pv?.decision) plate.review = pv.decision;
    if (historicalSizeHolds.has(sku)) plate.sizeHold = "Earlier sizing finding remains open; regrouping is not approval";
    if (localCandidates.has(sku)) plate.localCandidate = localCandidates.get(sku);
    if (sourceHolds.has(sku)) plate.sourceHold = sourceHolds.get(sku);
    plate.masterSourceRecorded = !!pl && existsSync(path.resolve("/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master",pl.sourcePath)) && realpathSync(path.resolve("/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master",pl.sourcePath)).startsWith("/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master/");
    plate.checksPassed = ["plated", "plated-no-capoff-by-design"].includes(plate.state) && !plate.hold && !plate.issues?.length && !plate.sizeHold && !plate.sourceHold && plate.masterSourceRecorded;
    plate.complete = plate.checksPassed && !!plate.approval;
    // kit
    let kit;
    let kitFromBostonRelease = false;
    const kl = kitsLive.get(sku); const kc = kitCsv.get(sku);
    if (NO_PLATE_CATEGORY.has(p?.category ?? "")) kit = {state:"not-applicable", reason:`${p.category}: no bottle kit required`};
    else if (kl) kit = { state: kitIssues.has(sku) ? "stale" : "live", completeness: kl.completeness, parts: kl.parts, issues: kitIssues.get(sku) };
    else if (kitIssues.has(sku)) kit = { state: "stale", issues: kitIssues.get(sku) };
    else if (kv?.decision) kit = { state: kv.decision.status === "approved" ? "approved-not-published" : kv.decision.status, review: kv.decision };
    else if (kc?.state === "kit_candidate") kit = { state: "candidate", reason: kc.reason || undefined };
    else if (kc?.state === "held_with_reason") kit = { state: "held", reason: kc.reason };
    else if (kc?.state === "kit_not_applicable") kit = { state: "not-applicable", reason: kc.reason || undefined };
    else if (kc?.state === "kit_complete") kit = { state: convex ? "stale" : "unknown", reason: "complete on 2026-09-08 but not served by Convex today" };
    else if (kv) kit = { state: kv.status };
    else kit = { state: plate.state.startsWith("plated") ? "none" : "no-plate" };
    const bostonKit = bostonKitApprovals.get(sku);
    if (bostonKit && bostonKit.plateSha256 === plate.sha256 && kit.state !== "live") {
        kitFromBostonRelease = true;
        kit = { state: "approved-not-published", review: { status: "approved", sha256: bostonKit.approval.plateSha256, collection: bostonKitRelease.id, updatedAt: bostonKit.approval.reviewedAt ?? null, notes: bostonKit.approval.scope }, candidate: { state: "approved", plateSha256: bostonKit.plateSha256, bytesVerified: true }, reason: "Kit approval is bound to the current plate; publication is gated by the kit ship instruction." };
    }
    if (kv?.decision && !kit.review) kit.review = kv.decision;
    if (kv) kit.candidate = {state:kv.status, sha256:kv.sha256, plateSha256:kv.plateSha256, collection:kv.collection, bytesVerified:kv.bytesVerified};
    if (!kitFromBostonRelease && kit.state === "approved-not-published" && (!kv?.plateSha256 || kv.plateSha256 !== plate.sha256)) {kit.state="stale";kit.reason="Approved kit requires verification against the current plate bytes";}
    rows.push({ sku, graceSku: p?.graceSku ?? reg?.graceSku ?? kc?.graceSku ?? null, family, category: p?.category ?? kc?.category ?? null, capacityMl: p?.capacityMl ?? reg?.capacityMl ?? null, color: p?.color ?? reg?.bottleColor ?? null, applicator: p?.applicator ?? null, itemName: p?.itemName ?? null, capColor: p?.capColor ?? null, capStyle: p?.capStyle ?? null, capHeight: p?.capHeight ?? null, trimColor: p?.trimColor ?? null, groupSlug: g?.slug ?? reg?.groupSlug ?? null, productRecord: !!p, productGroupId: p?.productGroupId ?? null, hero, plate, kit });
}

note("plate.contact-sheet-reviews", await applyPlateSheetReviews(root, rows, plates));

const recoveredSources=await readSourceRecovery(root);
const sourceRecovery=recoveredSources ? {family:recoveredSources.family,configurations:recoveredSources.rows.length,withMasterCandidates:recoveredSources.rows.filter(r=>r.candidates.length).length,sourceApproved:recoveredSources.sourceApproved,existingPairedSources:recoveredSources.rows.filter(r=>r.pairStatus==='paired_source_views').length,capOnReviewPending:recoveredSources.rows.filter(r=>r.pairStatus==='cap_on_review_pending').length,finishedPlateApprovalsInherited:0} : null;
if(sourceRecovery) note('boston.master-source-recovery',sourceRecovery);
const preparedPlates=await readCompletion(root);
const cylinderFinalPreparation=await applyCylinderFinalPreparation(root,rows);
if(cylinderFinalPreparation)note('cylinder.final-plate-preparation',cylinderFinalPreparation);
const cylinderRelease=await readCylinderFinalRelease(root);
if(cylinderRelease){
 const sheet=await readCylinderFinalPlates(root);
 if(new URL(cylinderRelease.authorization.deployment).hostname.split('.')[0]===deployment)
  note('cylinder.final-plate-release',await applyCylinderFinalRelease(rows,plates,sheet,cylinderRelease));
}
const platePreparation=preparedPlates?.summary ?? null;
if(platePreparation){
 note('boston.plate-preparation',platePreparation);
 note('boston.indexed-plate-reviews',await applyPreparedPlateReviews(rows,plates,preparedPlates));
}

const dispositionPath=path.join(root,'data/asset-ledger/plate-scope-dispositions.json');
const dispositions=existsSync(dispositionPath)?readJson(dispositionPath):{version:1,entries:[]};
const dispositionRecords=new Map();
if(convex){
 const lookupSkus=[...new Set(dispositions.entries.flatMap(e=>[e.sku,e.canonicalSku]))];
 const lookups=await Promise.allSettled(lookupSkus.map(sku=>convex.query(api.products.lookupSku,{sku})));
 lookups.forEach((result,i)=>{if(result.status==='fulfilled'&&result.value?.product)dispositionRecords.set(lookupSkus[i],result.value.product);});
}
const plateScopeAudit=applyPlateScope(rows,products,dispositions,dispositionRecords);
note('plate.scope-dispositions',{path:path.relative(root,dispositionPath),...plateScopeAudit});

const DONE_PLATE = ["plated", "plated-no-capoff-by-design"];

// ---------- summaries ----------
const count = (list, pick) => { const c = {}; for (const r of list) { const k = pick(r); c[k] = (c[k] ?? 0) + 1; } return Object.fromEntries(Object.entries(c).sort((a, b) => b[1] - a[1])); };
const summary = { skus: rows.length, productRecords: rows.filter((r) => r.productRecord).length, heroes: count(rows, (r) => r.hero.state), plates: count(rows, (r) => r.plate.state), kits: count(rows, (r) => r.kit.state) };

// A hero is published once per PRODUCT GROUP — the catalogue shows one image per
// group, not one per SKU — so counting indexed heroes against the SKU total reads
// as 12 % when the family is actually finished. Heroes are scored against groups.
const HERO_WAITING = ["approved-not-locked", "approved-not-indexed", "indexed-stale", "pending", "rendered"];
const HERO_PROBLEM = ["changes_requested", "rejected", "indexed-missing-file", "indexed-manifest-mismatch", "indexed-stale"];
const KIT_WAITING = ["approved-not-published", "candidate", "rendered", "pending"];
const KIT_PROBLEM = ["changes_requested", "rejected", "stale", "held"];
const has = (list, keys) => keys.reduce((n, k) => n + (list[k] ?? 0), 0);

const famMap = new Map();
for (const r of rows.filter(r=>r.productRecord)) famMap.set(r.family, [...(famMap.get(r.family) ?? []), r]);
const families = [...famMap.entries()].sort((a, b) => b[1].length - a[1].length).map(([family, list]) => {
    const plateList=list.filter(r=>!r.plate.scopeExclusion);
    const heroes = count(list, (r) => r.hero.state), plates = count(plateList, (r) => r.plate.state), kits = count(list, (r) => r.kit.state);
    const groups = new Set(list.filter((r) => r.groupSlug).map((r) => r.groupSlug));
    const groupsWithHero = new Set(list.filter((r) => r.hero.state === "indexed" && r.hero.groupSlug === r.groupSlug && r.groupSlug).map((r) => r.groupSlug));
    const groupsWithSunburst = new Set(list.filter((r) => r.hero.state === "indexed" && r.hero.generation === "sunburst-approved" && r.hero.groupSlug === r.groupSlug && r.groupSlug).map((r) => r.groupSlug));
    const skusNoGroup = list.filter((r) => !r.groupSlug).length;
    // plates and kits are per SKU; a SKU with no plate cannot have a kit, and some products take no kit at all
    const plateApplicable = plateList.length - (plates["not-applicable"] ?? 0);
    const plated = plateList.filter(r=>r.plate.complete&&!r.plate.scopeHold).length, platedFull = plated;
    const kitApplicable = list.length - (kits["not-applicable"] ?? 0);
    const blockers = [];
    if (groups.size && groupsWithSunburst.size < groups.size) blockers.push(`${groups.size - groupsWithSunburst.size} product groups still need an approved, locked, indexed Sunburst hero`);
    if (has(heroes, HERO_PROBLEM)) blockers.push(`${has(heroes, HERO_PROBLEM)} hero(es) flagged or stale`);
    if (plates["none"]) blockers.push(`${plates["none"]} SKU(s) with no plate`);
    if (plates["plated-wrong-size"]) blockers.push(`${plates["plated-wrong-size"]} plate(s) the wrong size for their bottle`);
    if (plates["plated-legacy-source"]) blockers.push(`${plates["plated-legacy-source"]} plate(s) built from legacy GIFs`);
    if (plates["plated-cap-on-only"]) blockers.push(`${plates["plated-cap-on-only"]} plate(s) missing a cap-off view`);
    if (list.some(r=>r.plate.sizeHold)) blockers.push(`${list.filter(r=>r.plate.sizeHold).length} unresolved sizing findings`);
    if (plated < plateApplicable) blockers.push(`${plateApplicable-plated} plates need checks or current-byte visual approval`);
    if (plates["hold"]) blockers.push(`${plates["hold"]} plate(s) on hold`);
    if ((kits["live"] ?? 0) < kitApplicable) blockers.push(`${kitApplicable - (kits["live"] ?? 0)} SKU(s) without a published kit`);
    if (skusNoGroup) blockers.push(`${skusNoGroup} SKU(s) with no product group`);
    return {
        family, skus: list.length, groups: groups.size, groupsWithHero: groupsWithHero.size, groupsWithSunburst: groupsWithSunburst.size, plateChecked: list.filter(r=>r.plate.checksPassed).length,
        heroWaiting: has(heroes, HERO_WAITING), kitWaiting: has(kits, KIT_WAITING),
        plated, platedFull, plateApplicable, kitLive: kits["live"] ?? 0, kitApplicable,
        heroComplete: groups.size > 0 && groupsWithSunburst.size === groups.size && has(heroes, HERO_PROBLEM) === 0,
        plateComplete: platedFull === plateApplicable,
        kitComplete: (kits["live"] ?? 0) === kitApplicable,
        blockers, heroes, plates, kits,
    };
}).map((f) => ({ ...f, complete: f.heroComplete && f.plateComplete && f.kitComplete }));

const groupRows = groups.map(g => {
    const members = rows.filter(r=>r.productGroupId === g._id);
    const indexed = rows.filter(r=>r.hero.groupSlug === g.slug && r.hero.state === "indexed");
    const approved = indexed.filter(r=>r.hero.generation === "sunburst-approved");
    return {id:g._id, slug:g.slug, family:g.family ?? "Unknown", capacityMl:g.capacityMl, color:g.color,
      skus:members.map(r=>r.sku), indexedSkus:indexed.map(r=>r.sku), sunburstSkus:approved.map(r=>r.sku),
      state:approved.length ? "complete" : indexed.length ? "prior-release" : "missing"};
});
for (const family of families) {
    const gs = groupRows.filter(g=>g.family === family.family);
    family.groups = gs.length;
    family.groupsWithHero = gs.filter(g=>g.indexedSkus.length).length;
    family.groupsWithSunburst = gs.filter(g=>g.state === "complete").length;
    family.heroComplete = gs.length > 0 && gs.every(g=>g.state === "complete");
    family.complete = family.heroComplete && family.plateComplete && family.kitComplete && !family.blockers.length;
}

const out = { schemaVersion: 2, sourceRecovery, platePreparation, bottleStandards:readJson(path.join(root,"data/asset-ledger/bottle-standards.json")), groupRows, reviewAudit, scope: {catalogReconciled:false, reviewOnly:rows.filter(r=>!r.productRecord).length, groupRecords:groups.length, duplicateProductRecords:products.filter(p=>p.websiteSku).length-new Set(products.filter(p=>p.websiteSku).map(p=>p.websiteSku)).size, missingSkuRecords: products.filter(p=>!p.websiteSku).map(p=>({id:p._id,family:p.family,itemName:p.itemName,productGroupId:p.productGroupId})), catalogRecordCount:products.length, localPlateCandidates:localCandidates.size, sourceHolds:sourceHolds.size, note:"Current catalog snapshot; live legacy variant scope and physical bottle groups still require reconciliation."}, generatedAt: new Date().toISOString(), deployment, sources, states: {
    hero: { indexed: "registry row, file on disk, bytes match the manifest", "indexed-stale": "indexed, but a newer approved lock exists — a release will repoint it", "indexed-missing-file": "registry row points at a file that is not on disk", "indexed-manifest-mismatch": "the file on disk does not match the manifest hash", "approved-not-indexed": "approved and locked by hash; no registry row yet", "approved-not-locked": "approved on a card; not yet locked", changes_requested: "Jordan asked for a change on the latest card", rejected: "rejected on the latest card", pending: "on a card, decision pending", rendered: "an image exists on a card; no decision", none: "no hero image anywhere" },
    plate: { "plated-approved-legacy-source": "Current paired views match Jordan’s exact approved original-source exception; master PSD provenance is not claimed", plated: "front + cap-off plate served by Convex, glass the right size, built from the PSD master", "plated-no-capoff-by-design": "two-piece product (bulb, tassel, atomizer, reducer, dropper): served, no cap to take off", "plated-wrong-size": "served, but the glass is more than 5% off its bottle's width — the plate is wrong and must be rebuilt", "plated-legacy-source": "served, but built from a legacy website GIF rather than the PSD master — to be rebuilt", "plated-cap-on-only": "front plate only; this product should have a cap-off view and does not", hold: "held with a reason, no plate", none: "no plate", "not-applicable": "not a bottle (component, packaging, gift bag/box)", unknown: "Convex not read" },
    kit: { live: "kit served by Convex and registered to the current plate", stale: "kit exists but not registered to the served plate", "approved-not-published": "approved on a kit card; not published", changes_requested: "change requested on the latest kit card", rejected: "rejected on the latest kit card", pending: "on a kit card, decision pending", candidate: "kit candidate (2026-09-08 ledger)", held: "held with a reason (2026-09-08 ledger)", "not-applicable": "no kit for this product kind", rendered: "kit image on a card, no decision", none: "plated, no kit work", "no-plate": "no plate, so no kit" },
}, scoring: {
    hero: "per PRODUCT GROUP — the catalogue shows one hero per group, so a family is scored on groups covered, not SKUs",
    plate: "per SKU that is a bottle; complete only when the plate is served, the right size for its bottle, from the PSD master or an explicitly approved exact-source release exception, and has its cap-off view unless the product is two-piece",
    kit: "per SKU that can take a kit (SKUs marked not-applicable are excluded)",
    complete: "a family is complete when heroes, plates and kits are all complete and nothing is flagged or stale",
}, summary, families, rows };

mkdirSync(path.join(root, "src/lib/asset-ledger"), { recursive: true });
// Jordan's completeness rule, 2026-09-13: the live legacy site decides what
// exists and what can still be obtained. Recording it here stops the plan
// presenting a source hold as a dead end when the asset is in fact available.
const legacyReconPath = path.join(root, "data/asset-ledger/legacy-asset-reconciliation.json");
out.legacyAssetReconciliation = existsSync(legacyReconPath) ? readJson(legacyReconPath) : null;
if (out.legacyAssetReconciliation) {
    const lr = out.legacyAssetReconciliation;
    note("plate.legacy-asset-reconciliation", { path: "data/asset-ledger/legacy-asset-reconciliation.json",
        generatedAt: lr.generatedAt, networkChecked: lr.networkChecked,
        legacyCatalogGeneratedAt: lr.legacyCatalog?.generatedAt, ...lr.summary });
}
// Jordan's source decision on the rows that had no candidate: the legacy
// photograph is accepted as their source, cap-on only. It settles the source
// question; it does not make them plates.
const legacyHoldPath = path.join(root, "data/asset-ledger/legacy-hold-source-decisions.json");
out.legacyHoldDecision = existsSync(legacyHoldPath) ? readJson(legacyHoldPath) : null;
if (out.legacyHoldDecision) {
    const d = out.legacyHoldDecision;
    note("plate.legacy-hold-source-decision", { path: "data/asset-ledger/legacy-hold-source-decisions.json",
        decidedAt: d.decidedAt, sourceApproved: d.approvedRows, queuedForRegeneration: d.regenerateRows,
        capOnAccepted: d.capOnAccepted, plateApproved: d.plateApproved, publicationAuthorized: d.publicationAuthorized });
}
// Every family's exact-byte approval lock, so an image Jordan has already
// signed off is never sent back for another review. A lock is visual approval
// only; publication and indexing stay separate and are checked above.
out.plateReleaseLocks = readPlateReleaseLocks(root);
for (const lock of out.plateReleaseLocks) {
    if (lock.skipped) { note("plate.release-lock-skipped", { path: lock.path, release: lock.release, reason: lock.skipped }); continue; }
    note("plate.release-lock", { path: lock.path, release: lock.release, rows: lock.rows, held: lock.held.length,
        approvedAt: lock.approvedAt, publicationAuthorized: lock.publicationAuthorized, indexingAuthorized: lock.indexingAuthorized });
}
out.platePlan = buildPlatePlan(out);
writeFileSync(path.join(root, "src/lib/asset-ledger/ledger.json.tmp"), JSON.stringify(out, null, 1) + "\n");
renameSync(path.join(root,"src/lib/asset-ledger/ledger.json.tmp"),path.join(root,"src/lib/asset-ledger/ledger.json"));
console.log(JSON.stringify({ generatedAt: out.generatedAt, deployment, ...summary }, null, 2));
