#!/usr/bin/env node
// Publish paper-doll plates: bytes to the store, rows to the Convex index.
//
//   node scripts/paperdoll/publish.mjs --from public/paper-doll            # the four legacy families
//   node scripts/paperdoll/publish.mjs --dist dist/paper-doll/manifest.json  # pipeline output
//   add --family <id> or --neck <id> (e.g. 13-415) to limit, --apply to actually write (dry run by default),
//   a SKU that already carries a plate on the target is SKIPPED unless --replace is passed,
//   --allow-orphans to index SKUs the catalogue does not carry yet (normally skipped)
//   --dist publishing requires tokens.json.reviewedAt (Jordan's sign-off); --skip-token-review for dev only
//
// Order of operations per plate, and the reason it is this order: hash the
// bytes → upload under a content-addressed key → HEAD-verify the PUBLIC url
// (200, image/webp, length, CORS, cache) → only then write the row. A row is
// the page's readiness, so a row is never written for bytes a browser could
// not fetch. Nothing is ever overwritten or deleted.
//
// Env: BLOB_READ_WRITE_TOKEN (store), BEST_BOTTLES_CONVEX_WRITE_TOKEN (index),
// NEXT_PUBLIC_CONVEX_URL (which deployment). Run from the repo root after
// `set -a; source .env.local; set +a`.
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import { createBlobStore, verifyPublicUrl } from "./lib/store-blob.mjs";

const BUILDER = { name: "publish.mjs", version: "1.0.0" };
const CANVAS = { width: 1000, height: 1100 };
const THUMB = { width: 240, height: 240 };

// The four families shipped from the repo used ad-hoc ids; the index uses
// <family>-<capacityMl>ml-<color>-<neck>. The 9 mL folder held five glasses
// under one id and splits by each row's `glass`.
const LEGACY_FAMILY = {
    "diva-46-clear": { familyId: "diva-46ml-clear-18-415", name: "Diva 46 ml — Clear", neck: "18-415" },
    "diva-46-frosted": { familyId: "diva-46ml-frosted-18-415", name: "Diva 46 ml — Frosted", neck: "18-415" },
    "cylinder-50ml-clear": { familyId: "cylinder-50ml-clear-18-415", name: "Cylinder 50 ml — Clear", neck: "18-415" },
    "cylinder-9ml-17-415": {
        neck: "17-415",
        byGlass: {
            Clear: { familyId: "cylinder-9ml-clear-17-415", name: "Cylinder 9 mL — Clear" },
            Amber: { familyId: "cylinder-9ml-amber-17-415", name: "Cylinder 9 mL — Amber" },
            "Cobalt Blue": { familyId: "cylinder-9ml-cobalt-blue-17-415", name: "Cylinder 9 mL — Cobalt Blue" },
            Frosted: { familyId: "cylinder-9ml-frosted-17-415", name: "Cylinder 9 mL — Frosted" },
            Swirl: { familyId: "cylinder-9ml-swirl-17-415", name: "Cylinder 9 mL — Swirl" },
        },
    },
};

const args = parseArgs(process.argv.slice(2));
const apply = Boolean(args.apply);
const onlyFamily = args.family ?? null;
// Jordan publishes by NECK, not by family: closures and registration references
// are shared per neck, and a neck going live is one command, not nineteen.
const onlyNeck = args.neck ?? null;

async function main() {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!convexUrl) fail("NEXT_PUBLIC_CONVEX_URL is not set");
    if (apply && !writeToken) fail("BEST_BOTTLES_CONVEX_WRITE_TOKEN is not set");

    const plan = args.from ? await planFromLegacy(resolve(args.from)) : args.dist ? await planFromDist(resolve(args.dist)) : fail("pass --from <public/paper-doll> or --dist <manifest.json>");
    if (args.dist && apply) {
        // the pipeline's vocabulary (finish labels, body -> family) is a publish precondition: Jordan signs tokens.json
        const tokens = JSON.parse(await readFile(resolve("data/paper-doll/tokens.json"), "utf8"));
        if (!tokens.reviewedAt && !args["skip-token-review"]) fail("data/paper-doll/tokens.json has no reviewedAt — review it first (or pass --skip-token-review for a dev-only publish)");
    }
    const families = onlyFamily ? plan.families.filter((f) => f.familyId === onlyFamily)
        : onlyNeck ? plan.families.filter((f) => f.familyId.endsWith(`-${onlyNeck}`))
        : plan.families;
    if (families.length === 0) fail(`no family matched ${onlyFamily ?? onlyNeck}`);
    if (onlyNeck) console.log(`neck ${onlyNeck}: ${families.length} families, ${families.reduce((n, f) => n + f.rows.length, 0)} SKUs`);

    console.log(`${apply ? "PUBLISH" : "DRY RUN"} → ${convexUrl}`);
    const convex = new ConvexHttpClient(convexUrl);

    // A SKU that already has a plate on the target is left alone unless --replace
    // says otherwise. --neck 17-415 would otherwise have re-published the five
    // live 9 mL colour families beside the 19 new components (2 Sep): different
    // bytes from the layered renders the kits were cut from, nobody's review,
    // and every kit's plate-parity check broken. "Publish a neck" means what is
    // NEW at that neck; replacing something live is a separate, named decision.
    const replace = Boolean(args.replace);
    let held = 0;
    for (const family of families) {
        const onTarget = await platePresence(convex, family.rows.flatMap((r) => [r.sku, r.graceSku].filter(Boolean)));
        const existing = family.rows.filter((r) => onTarget.has(r.sku) || (r.graceSku && onTarget.has(r.graceSku)));
        family.existing = existing.length;
        if (!replace && existing.length) {
            held += existing.length;
            family.rows = family.rows.filter((r) => !existing.includes(r));
        }
    }
    const live = families.filter((f) => f.rows.length);
    for (const family of families) {
        const note = family.existing
            ? (replace ? ` (replacing ${family.existing} already on the target)` : ` (${family.existing} already on the target, held)`)
            : "";
        console.log(`\n=== ${family.name} (${family.familyId}) — ${family.rows.length} SKUs, ${family.rows.reduce((n, r) => n + r.assets.length, 0)} objects${note} ===`);
    }
    if (held) console.log(`\n${held} SKU(s) already carry a plate on ${convexUrl} and are held; pass --replace to re-publish them.`);
    if (!live.length) { console.log("nothing to publish."); return; }
    families.length = 0; families.push(...live);
    if (!apply) {
        const sample = families[0].rows[0];
        console.log(`\nexample key: ${sample.assets[0].key}`);
        for (const family of families) {
            const presence = await productPresence(convex, family.rows.map((r) => r.sku));
            const orphans = family.rows.filter((r) => (presence[r.sku]?.count ?? 0) === 0).map((r) => r.sku);
            const duplicated = family.rows.filter((r) => (presence[r.sku]?.count ?? 0) > 1).length;
            console.log(`${family.familyId}: ${orphans.length} SKU(s) no product carries${orphans.length ? ` (${orphans.join(", ")})` : ""}; ${duplicated} on duplicated catalogue SKUs`);
        }
        console.log("re-run with --apply to upload, verify and index.");
        return;
    }

    const store = createBlobStore();
    const buildId = new Date().toISOString().replace(/[:.]/g, "-");
    const report = { buildId, builder: BUILDER, convexUrl, families: [] };

    for (const family of families) {
        const familyReport = { familyId: family.familyId, uploaded: 0, existed: 0, verified: 0, written: 0, unchanged: 0, skipped: [], duplicateSku: 0, graceRestamped: 0, errors: [] };
        const rows = [];
        for (const row of family.rows) {
            const assets = {};
            let ok = true;
            for (const asset of row.assets) {
                const bytes = await readFile(asset.path);
                const sha256 = createHash("sha256").update(bytes).digest("hex");
                if (sha256 !== asset.sha256) fail(`hash drift for ${asset.path}`);
                const { url, existed } = await store.putObject(asset.key, bytes, "image/webp");
                existed ? familyReport.existed++ : familyReport.uploaded++;
                const verdict = await verifyPublicUrl(url, { expectedBytes: bytes.length, expectedContentType: "image/webp" });
                if (!verdict.ok) {
                    familyReport.errors.push({ sku: row.sku, key: asset.key, problems: verdict.problems });
                    ok = false;
                    break;
                }
                familyReport.verified++;
                assets[asset.role] = { url, key: asset.key, sha256, bytes: bytes.length, width: asset.width, height: asset.height };
            }
            if (!ok) continue;
            rows.push({
                sku: row.sku,
                websiteSku: row.websiteSku,
                graceSku: row.graceSku,
                familyId: family.familyId,
                front: assets.front,
                frontCapOff: assets.frontCapOff ?? null,
                thumb: assets.thumb,
                thumbCapOff: assets.thumbCapOff ?? null,
                views: [],
                source: row.source,
                builder: { ...BUILDER, builtAt: Date.now() },
                storageProvider: store.provider,
            });
        }
        // never index a plate no product can reach: the page keys by the catalogue's SKUs, so an
        // orphan row is dead weight the integrity sweep would flag. Objects are uploaded regardless
        // (content-addressed; the row appears the moment the catalogue carries the SKU).
        const presence = await productPresence(convex, rows.map((r) => r.sku));
        const indexable = [];
        for (const row of rows) {
            const found = presence[row.sku] ?? { count: 0, graceSku: null };
            if (found.count === 0 && !args["allow-orphans"]) { familyReport.skipped.push({ sku: row.sku, reason: "no_product" }); continue; }
            if (found.count > 1) familyReport.duplicateSku++;
            // the grace SKU is whatever the product document says today, never what a
            // manifest or a spreadsheet remembers
            if (found.graceSku !== row.graceSku) familyReport.graceRestamped++;
            row.graceSku = found.graceSku;
            indexable.push(row);
        }
        for (let i = 0; i < indexable.length; i += 50) {
            const results = await convex.mutation(api.productPlates.upsertMany, { writeToken, rows: indexable.slice(i, i + 50) });
            for (const result of results) {
                if (result.outcome === "error") familyReport.errors.push({ sku: result.sku, error: result.error });
                else if (result.outcome === "unchanged") familyReport.unchanged++;
                else familyReport.written++;
            }
        }
        await convex.mutation(api.productPlates.upsertFamilies, {
            writeToken,
            families: [{
                familyId: family.familyId,
                name: family.name,
                neckFinish: family.neck,
                canvas: CANVAS,
                closures: family.closures,
                bodyMask: null,
                variantCount: indexable.length,
                buildId,
            }],
        });
        report.families.push(familyReport);
        console.log(`  uploaded ${familyReport.uploaded}, existed ${familyReport.existed}, verified ${familyReport.verified}, rows written ${familyReport.written}, unchanged ${familyReport.unchanged}, skipped ${familyReport.skipped.length} (no product), on duplicated SKUs ${familyReport.duplicateSku}, grace SKUs restamped ${familyReport.graceRestamped}, errors ${familyReport.errors.length}`);
        for (const skip of familyReport.skipped.slice(0, 10)) console.log(`   -- ${skip.sku}: ${skip.reason}`);
        for (const error of familyReport.errors.slice(0, 10)) console.log("   !!", JSON.stringify(error));
    }

    // the immutable record of what this run did, beside the plates
    const record = Buffer.from(JSON.stringify(report, null, 2));
    const key = `plates/_builds/${buildId}-${families.map((f) => f.familyId).join("+").slice(0, 120)}.json`;
    await store.putObject(key, record, "application/json");
    console.log(`\nbuild record: ${key}`);
    const failed = report.families.some((f) => f.errors.length > 0);
    console.log(failed ? "\nFINISHED WITH ERRORS — run scripts/paperdoll/verify.mjs and read the record" : "\nOK — now run scripts/paperdoll/verify.mjs");
    process.exit(failed ? 1 : 0);
}

/** The repo's four legacy families, straight from their manifests. */
async function planFromLegacy(root) {
    const families = [];
    for (const dir of await readdir(root)) {
        const legacy = LEGACY_FAMILY[dir];
        if (!legacy) continue;
        const manifestPath = join(root, dir, "manifest.json");
        let manifest;
        try { manifest = JSON.parse(await readFile(manifestPath, "utf8")); } catch { continue; }
        const groups = new Map(); // familyId -> { name, neck, closures, rows }
        for (const variant of manifest.variants) {
            const target = legacy.byGlass ? legacy.byGlass[variant.glass] : legacy;
            if (!target) fail(`no family for glass ${variant.glass} in ${dir}`);
            const websiteSku = variant.websiteSku ?? (legacy.byGlass ? null : variant.sku);
            if (!websiteSku) fail(`no websiteSku for ${variant.sku} in ${dir}`);
            const sku = websiteSku;
            // a stray Photoshop "copy" file can reach a legacy manifest as a SKU with a space in
            // it; it is not a catalogue SKU, so skip the row rather than refusing the whole plan
            if (!/^[A-Za-z0-9._-]+$/.test(sku)) {
                console.log(`   -- ${dir}: skipping "${sku}" (not a SKU)`);
                continue;
            }
            const assets = [];
            const push = async (role, rel, size) => {
                if (!rel) return;
                // the manifests store site-absolute paths ("/paper-doll/<family>/<sku>.webp") from
                // when these plates were served out of public/. Resolve by the file's own name inside
                // the family folder we are reading, so the output can live anywhere.
                const path = join(root, dir, rel.split("/").pop());
                const bytes = await readFile(path);
                const sha256 = createHash("sha256").update(bytes).digest("hex");
                const cap = role.endsWith("CapOff") ? "off" : "on";
                const dims = role.startsWith("thumb") ? THUMB : CANVAS;
                assets.push({ role, path, sha256, width: dims.width, height: dims.height, key: `plates/${target.familyId}/${safeKey(sku)}/${sha256}.front-${cap}-${dims.width}x${dims.height}.webp` });
            };
            await push("front", variant.image);
            await push("thumb", variant.thumb);
            await push("frontCapOff", variant.imageCapOff);
            await push("thumbCapOff", variant.thumbCapOff);
            const group = groups.get(target.familyId) ?? { familyId: target.familyId, name: target.name, neck: legacy.neck, closures: new Map(), rows: [] };
            group.closures.set(variant.closure, { id: variant.closure, label: variant.closureLabel, count: (group.closures.get(variant.closure)?.count ?? 0) + 1 });
            group.rows.push({
                sku, websiteSku, graceSku: variant.graceSku ?? null,
                assets,
                source: { library: "public-paper-doll", path: `${dir}/${variant.sourcePsd ?? ""}`, psdSha256: null, psdSha256CapOff: null },
            });
            groups.set(target.familyId, group);
        }
        for (const group of groups.values()) families.push({ ...group, closures: [...group.closures.values()] });
    }
    return { families };
}

/** Pipeline output (dist/paper-doll/manifest.json) — rows already carry keys and hashes. */
async function planFromDist(manifestPath) {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const root = join(manifestPath, "..");
    const byFamily = new Map();
    for (const row of manifest.rows) {
        if (!row.publishable) continue;
        const assets = [];
        for (const [role, asset] of Object.entries({ front: row.plate, thumb: row.thumb, frontCapOff: row.plateCapOff, thumbCapOff: row.thumbCapOff })) {
            if (!asset) continue;
            const path = join(root, asset.key);
            await stat(path);
            assets.push({ role, path, sha256: asset.sha256, width: asset.width, height: asset.height, key: asset.storeKey ?? asset.key });
        }
        const family = byFamily.get(row.familyId) ?? { familyId: row.familyId, name: row.familyName ?? row.familyId, neck: row.neck ?? "", closures: [], rows: [] };
        family.rows.push({ sku: row.websiteSku, websiteSku: row.websiteSku, graceSku: row.graceSku ?? null, assets, source: { library: row.plate.sourceLibrary ?? "dist", path: row.plate.sourceRelPath ?? "", psdSha256: row.plate.sourceSha256 ?? null, psdSha256CapOff: row.plateCapOff?.sourceSha256 ?? null } });
        byFamily.set(row.familyId, family);
    }
    return { families: [...byFamily.values()] };
}

function safeKey(sku) {
    if (!/^[A-Za-z0-9._-]+$/.test(sku)) fail(`KEY_UNSAFE: ${sku}`);
    return sku;
}

async function productPresence(convex, skus) {
    const counts = {};
    for (let i = 0; i < skus.length; i += 200) {
        Object.assign(counts, await convex.query(api.productPlates.productPresence, { skus: skus.slice(i, i + 200) }));
    }
    return counts;
}

function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith("--")) {
            const key = a.slice(2);
            const next = argv[i + 1];
            if (next && !next.startsWith("--")) { out[key] = next; i++; } else out[key] = true;
        }
    }
    return out;
}

/** which of these SKUs already have a plate row on the target deployment */
async function platePresence(convex, skus) {
    const found = new Set();
    const unique = [...new Set(skus)];
    for (let i = 0; i < unique.length; i += 200) {
        const page = await convex.query(api.productPlates.forSkus, { skus: unique.slice(i, i + 200) });
        for (const sku of Object.keys(page.plates ?? {})) found.add(sku);
    }
    return found;
}

function fail(message) {
    console.error(`publish: ${message}`);
    process.exit(1);
}

main().catch((error) => { console.error(error); process.exit(1); });
