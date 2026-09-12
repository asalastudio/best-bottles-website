#!/usr/bin/env node
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
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

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
    convex = new ConvexHttpClient(url); deployment = url.replace(/^https?:\/\//, "").replace(/\.convex\.cloud$/, "");
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
for (const dir of readdirSync(path.join(root, "docs/reviews")).filter((d) => /^sunburst-heroes-release-\d+$/.test(d)).sort()) {
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
const seenRoots = new Set(); const review = { hero: new Map(), kit: new Map() }; // kind -> sku -> {rendered, decision}
for (const r of roots) {
    const real = path.resolve(r); if (seenRoots.has(real)) continue; seenRoots.add(real);
    let collections = 0, rows = 0, decisions = 0;
    for (const id of readdirSync(real)) {
        const cdir = path.join(real, id); if (!existsSync(path.join(cdir, "collection.json"))) continue;
        const kind = /kit/i.test(id) ? "kit" : "hero"; const col = readJson(path.join(cdir, "collection.json"));
        const data = readJson(path.join(cdir, "data.json")); const fb = existsSync(path.join(cdir, "feedback.json")) ? readJson(path.join(cdir, "feedback.json")) : { decisions: {} };
        collections++; rows += data.length;
        for (const row of data) { const cur = review[kind].get(row.sku) ?? { rendered: 0, collections: [] }; cur.rendered++; cur.collections.push(id); review[kind].set(row.sku, cur); }
        for (const d of Object.values(fb.decisions ?? {})) {
            decisions++; const cur = review[kind].get(d.sku) ?? { rendered: 0, collections: [] };
            if (!cur.decision || (d.updatedAt ?? "") > (cur.decision.updatedAt ?? "")) cur.decision = { status: d.status, sha256: d.assetSha256, collection: id, updatedAt: d.updatedAt, notes: (d.notes ?? "").trim() || undefined, targetHeight: d.targetHeight?.heightPercent ?? undefined };
            review[kind].set(d.sku, cur);
        }
    }
    note("review.root", { path: real, collections, rows, decisions });
}

// ---------- plates + kits (Convex) ----------
const plates = new Map(); const kitsLive = new Map(); const kitIssues = new Map(); const plateIssues = new Map(); let plateFamilies = [];
if (convex) {
    plateFamilies = await convex.query(api.productPlates.families, {});
    for (const fam of plateFamilies) { let cursor = null; for (;;) { const r = await convex.query(api.productPlates.byFamily, { familyId: fam.familyId, cursor, limit: 500 }); for (const p of r.page) plates.set(p.websiteSku ?? p.sku, { ...p, familyId: fam.familyId }); if (r.isDone) break; cursor = r.continueCursor; } }
    note("convex.productPlates", { deployment, families: plateFamilies.length, rows: plates.size });
    const sweep = async (fn, into) => { let cursor = null, checked = 0; for (;;) { const r = await convex.query(fn, { cursor, pageSize: 200 }); checked += r.checked; for (const i of r.issues) into.set(i.sku, [...(into.get(i.sku) ?? []), `${i.issue}${i.detail ? " " + i.detail : ""}`]); if (r.isDone) break; cursor = r.continueCursor; } return checked; };
    const pc = await sweep(api.productPlates.integrity, plateIssues); const kc = await sweep(api.productKits.integrity, kitIssues);
    note("convex.integrity", { deployment, platesChecked: pc, kitsChecked: kc, plateIssues: plateIssues.size, kitIssues: kitIssues.size });
    // kits have no list query: ask per plated SKU (a kit needs a plate), 25 at a time
    const plated = [...plates.keys()]; let done = 0;
    for (let i = 0; i < plated.length; i += 25) {
        await Promise.all(plated.slice(i, i + 25).map(async (sku) => { const k = await convex.query(api.productKits.forSku, { websiteSku: sku, graceSku: plates.get(sku)?.graceSku ?? null }); if (k) kitsLive.set(sku, { completeness: k.completeness, plateSha256: k.plateSha256, parts: k.parts?.length ?? 0 }); }));
        done += 25; if (done % 500 === 0) console.error(`kits ${Math.min(done, plated.length)}/${plated.length}`);
    }
    note("convex.productKits", { deployment, live: kitsLive.size, askedFor: plated.length });
}

// ---------- plate geometry: existence is not correctness ----------
// scripts/asset-ledger/measure-plates.py measures every served plate; a plate whose glass is
// the wrong width for its bottle, or that was built from a legacy website GIF, must not count as done.
const geomPath = path.join(root, "src/lib/asset-ledger/plate-geometry.json");
const geom = existsSync(geomPath) ? readJson(geomPath) : null;
if (geom) note("plate.geometry", { path: "src/lib/asset-ledger/plate-geometry.json", generatedAt: geom.generatedAt, ...geom.summary });
// Jordan, 2026-09-12: these closures are two-piece products; there is no cap to take off, so no cap-off view is owed.
const TWO_PIECE = new Set(["Vintage Bulb Sprayer", "Vintage Bulb Sprayer with Tassel", "Atomizer", "Reducer", "Dropper"]);
// Product kinds that never take a plate: they are not bottles.
const NO_PLATE_CATEGORY = new Set(["Component", "Packaging", "Accessory", "Gift Bag", "Gift Box"]);

// ---------- local kit + plate ledgers ----------
const kitCsv = new Map();
const csvPath = path.join(root, "docs/reviews/catalog-kit-completion-2026-09-08/kit-completion-ledger.csv");
if (existsSync(csvPath)) {
    const [head, ...lines] = readFileSync(csvPath, "utf8").trim().split("\n"); const cols = head.split(",");
    for (const line of lines) { const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')); const rec = Object.fromEntries(cols.map((c, i) => [c, cells[i]])); kitCsv.set(rec.websiteSku, rec); }
    note("kit.completionLedger", { path: "docs/reviews/catalog-kit-completion-2026-09-08/kit-completion-ledger.csv", rows: kitCsv.size });
}
const plateHolds = new Map();
const holdPath = path.join(root, "data/paper-doll/priority-family-kit-holds-2026-09-08.json");
if (existsSync(holdPath)) { for (const r of readJson(holdPath).rows) plateHolds.set(r.websiteSku, r); note("plate.holds", { path: "data/paper-doll/priority-family-kit-holds-2026-09-08.json", rows: plateHolds.size }); }

// ---------- join ----------
const skus = new Set([...products.map((p) => p.websiteSku).filter(Boolean), ...registry.map((r) => r.websiteSku), ...plates.keys(), ...review.hero.keys(), ...review.kit.keys(), ...kitCsv.keys()]);
const registryBySku = new Map(registry.map((r) => [r.websiteSku, r]));
const productBySku = new Map(products.map((p) => [p.websiteSku, p]));
const rows = [];
for (const sku of [...skus].sort()) {
    const p = productBySku.get(sku); const reg = registryBySku.get(sku); const man = manifestBySku.get(sku); const lock = heroLocks.get(sku); const rv = review.hero.get(sku); const kv = review.kit.get(sku);
    const g = p ? groupById.get(p.productGroupId) : null;
    const family = p?.family ?? reg?.family ?? kitCsv.get(sku)?.family ?? plates.get(sku)?.familyId?.split("-")[0] ?? "Unknown";
    // hero
    let hero;
    if (reg) {
        const file = path.join(root, "public", reg.url); const onDisk = existsSync(file);
        const fileSha = onDisk ? sha256(readFileSync(file)) : null;
        const approvedSha = lock?.sha256; const generation = approvedSha && approvedSha === fileSha ? "sunburst-approved" : lock ? "stale" : "prior-release";
        hero = { state: !onDisk ? "indexed-missing-file" : generation === "stale" ? "indexed-stale" : "indexed", generation, url: reg.url, sha256: fileSha, manifestSha256: man?.sha256, lock: lock?.release, groupSlug: reg.groupSlug };
        if (fileSha && man && fileSha !== man.sha256) hero.state = "indexed-manifest-mismatch";
    } else if (lock) hero = { state: "approved-not-indexed", sha256: lock.sha256, lock: lock.release, why: "no registry row for this product yet" };
    else if (rv?.decision) hero = { state: rv.decision.status === "approved" ? "approved-not-locked" : rv.decision.status, review: rv.decision };
    else if (rv) hero = { state: "rendered", collections: rv.collections.length };
    else hero = { state: "none" };
    if (rv?.decision && !hero.review) hero.review = rv.decision;
    // plate
    let plate;
    const pl = plates.get(sku);
    const pgm = geom?.plates?.[sku];
    const twoPiece = TWO_PIECE.has(p?.applicator ?? "");
    if (pl) {
        const hasCapOff = !!(pl.imageCapOff || pl.views?.some?.((v) => v.cap === "off"));
        let state;
        if (pgm?.wrongSize) state = "plated-wrong-size";
        else if (pgm?.legacySource) state = "plated-legacy-source";
        else if (hasCapOff) state = "plated";
        else if (twoPiece) state = "plated-no-capoff-by-design";
        else state = "plated-cap-on-only";
        plate = { state, familyId: pl.familyId, sha256: (pl.image ?? "").match(/([0-9a-f]{64})\./)?.[1] ?? null, revision: pl.revision,
                  capOff: hasCapOff, issues: plateIssues.get(sku),
                  ...(pgm ? { bodyWidth: pgm.bodyWidth, expectedWidth: pgm.expectedWidth, sizeDeviation: pgm.sizeDeviation, legacySource: pgm.legacySource } : {}) };
    }
    else if (plateHolds.has(sku)) plate = { state: "hold", hold: plateHolds.get(sku).holdType, reason: plateHolds.get(sku).reason };
    else if (NO_PLATE_CATEGORY.has(p?.category ?? "")) plate = { state: "not-applicable", reason: `${p.category}: not a bottle` };
    else plate = { state: convex ? "none" : "unknown" };
    if (pl && plateHolds.has(sku)) { plate.hold = plateHolds.get(sku).holdType; plate.reason = plateHolds.get(sku).reason; }
    // kit
    let kit;
    const kl = kitsLive.get(sku); const kc = kitCsv.get(sku);
    if (kl) kit = { state: "live", completeness: kl.completeness, parts: kl.parts, issues: kitIssues.get(sku) };
    else if (kitIssues.has(sku)) kit = { state: "stale", issues: kitIssues.get(sku) };
    else if (kv?.decision) kit = { state: kv.decision.status === "approved" ? "approved-not-published" : kv.decision.status, review: kv.decision };
    else if (kc?.state === "kit_candidate") kit = { state: "candidate", reason: kc.reason || undefined };
    else if (kc?.state === "held_with_reason") kit = { state: "held", reason: kc.reason };
    else if (kc?.state === "kit_not_applicable") kit = { state: "not-applicable", reason: kc.reason || undefined };
    else if (kc?.state === "kit_complete") kit = { state: convex ? "stale" : "unknown", reason: "complete on 2026-09-08 but not served by Convex today" };
    else if (kv) kit = { state: "rendered" };
    else kit = { state: plate.state.startsWith("plated") ? "none" : "no-plate" };
    if (kv?.decision && !kit.review) kit.review = kv.decision;
    rows.push({ sku, graceSku: p?.graceSku ?? reg?.graceSku ?? kc?.graceSku ?? null, family, category: p?.category ?? kc?.category ?? null, capacityMl: p?.capacityMl ?? reg?.capacityMl ?? null, color: p?.color ?? reg?.bottleColor ?? null, applicator: p?.applicator ?? null, groupSlug: g?.slug ?? reg?.groupSlug ?? null, productRecord: !!p, hero, plate, kit });
}

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
for (const r of rows) famMap.set(r.family, [...(famMap.get(r.family) ?? []), r]);
const families = [...famMap.entries()].sort((a, b) => b[1].length - a[1].length).map(([family, list]) => {
    const heroes = count(list, (r) => r.hero.state), plates = count(list, (r) => r.plate.state), kits = count(list, (r) => r.kit.state);
    const groups = new Set(list.filter((r) => r.groupSlug).map((r) => r.groupSlug));
    const groupsWithHero = new Set(list.filter((r) => r.hero.state === "indexed" && r.groupSlug).map((r) => r.groupSlug));
    const skusNoGroup = list.filter((r) => !r.groupSlug).length;
    // plates and kits are per SKU; a SKU with no plate cannot have a kit, and some products take no kit at all
    const plateApplicable = list.length - (plates["not-applicable"] ?? 0);
    const plated = has(plates, DONE_PLATE), platedFull = plated;
    const kitApplicable = list.length - (kits["not-applicable"] ?? 0);
    const blockers = [];
    if (groups.size && groupsWithHero.size < groups.size) blockers.push(`${groups.size - groupsWithHero.size} product group(s) with no indexed hero`);
    if (has(heroes, HERO_PROBLEM)) blockers.push(`${has(heroes, HERO_PROBLEM)} hero(es) flagged or stale`);
    if (plates["none"]) blockers.push(`${plates["none"]} SKU(s) with no plate`);
    if (plates["plated-wrong-size"]) blockers.push(`${plates["plated-wrong-size"]} plate(s) the wrong size for their bottle`);
    if (plates["plated-legacy-source"]) blockers.push(`${plates["plated-legacy-source"]} plate(s) built from legacy GIFs`);
    if (plates["plated-cap-on-only"]) blockers.push(`${plates["plated-cap-on-only"]} plate(s) missing a cap-off view`);
    if (plates["hold"]) blockers.push(`${plates["hold"]} plate(s) on hold`);
    if ((kits["live"] ?? 0) < kitApplicable) blockers.push(`${kitApplicable - (kits["live"] ?? 0)} SKU(s) without a published kit`);
    if (skusNoGroup) blockers.push(`${skusNoGroup} SKU(s) with no product group`);
    return {
        family, skus: list.length, groups: groups.size, groupsWithHero: groupsWithHero.size,
        heroWaiting: has(heroes, HERO_WAITING), kitWaiting: has(kits, KIT_WAITING),
        plated, platedFull, plateApplicable, kitLive: kits["live"] ?? 0, kitApplicable,
        heroComplete: groups.size > 0 && groupsWithHero.size === groups.size && has(heroes, HERO_PROBLEM) === 0,
        plateComplete: plateApplicable > 0 && platedFull === plateApplicable,
        kitComplete: kitApplicable > 0 && (kits["live"] ?? 0) === kitApplicable,
        blockers, heroes, plates, kits,
    };
}).map((f) => ({ ...f, complete: f.heroComplete && f.plateComplete && f.kitComplete }));

const out = { generatedAt: new Date().toISOString(), deployment, sources, states: {
    hero: { indexed: "registry row, file on disk, bytes match the manifest", "indexed-stale": "indexed, but a newer approved lock exists — a release will repoint it", "indexed-missing-file": "registry row points at a file that is not on disk", "indexed-manifest-mismatch": "the file on disk does not match the manifest hash", "approved-not-indexed": "approved and locked by hash; no registry row yet", "approved-not-locked": "approved on a card; not yet locked", changes_requested: "Jordan asked for a change on the latest card", rejected: "rejected on the latest card", pending: "on a card, decision pending", rendered: "an image exists on a card; no decision", none: "no hero image anywhere" },
    plate: { plated: "front + cap-off plate served by Convex, glass the right size, built from the PSD master", "plated-no-capoff-by-design": "two-piece product (bulb, tassel, atomizer, reducer, dropper): served, no cap to take off", "plated-wrong-size": "served, but the glass is more than 5% off its bottle's width — the plate is wrong and must be rebuilt", "plated-legacy-source": "served, but built from a legacy website GIF rather than the PSD master — to be rebuilt", "plated-cap-on-only": "front plate only; this product should have a cap-off view and does not", hold: "held with a reason, no plate", none: "no plate", "not-applicable": "not a bottle (component, packaging, gift bag/box)", unknown: "Convex not read" },
    kit: { live: "kit served by Convex and registered to the current plate", stale: "kit exists but not registered to the served plate", "approved-not-published": "approved on a kit card; not published", changes_requested: "change requested on the latest kit card", rejected: "rejected on the latest kit card", pending: "on a kit card, decision pending", candidate: "kit candidate (2026-09-08 ledger)", held: "held with a reason (2026-09-08 ledger)", "not-applicable": "no kit for this product kind", rendered: "kit image on a card, no decision", none: "plated, no kit work", "no-plate": "no plate, so no kit" },
}, scoring: {
    hero: "per PRODUCT GROUP — the catalogue shows one hero per group, so a family is scored on groups covered, not SKUs",
    plate: "per SKU that is a bottle; complete only when the plate is served, the right size for its bottle, from the PSD master, and has its cap-off view unless the product is two-piece",
    kit: "per SKU that can take a kit (SKUs marked not-applicable are excluded)",
    complete: "a family is complete when heroes, plates and kits are all complete and nothing is flagged or stale",
}, summary, families, rows };

mkdirSync(path.join(root, "src/lib/asset-ledger"), { recursive: true });
writeFileSync(path.join(root, "src/lib/asset-ledger/ledger.json"), JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify({ generatedAt: out.generatedAt, deployment, ...summary }, null, 2));
