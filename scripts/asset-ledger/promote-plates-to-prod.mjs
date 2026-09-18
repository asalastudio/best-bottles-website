#!/usr/bin/env node
/**
 * Promote finished plate rows from the DEV index to PRODUCTION.
 *
 * The storefront reads prod (precise-raccoon-123). Plate work has been landing
 * on dev, so 700+ finished plates are invisible to customers. Both deployments
 * point at the same public Vercel Blob store, so this is an INDEX write only:
 * no bytes are rendered, uploaded, moved or deleted.
 *
 * Rules this obeys:
 *   - ADDITIVE ONLY. A SKU that already has a row on prod is left exactly as it
 *     is, whatever dev holds, because prod's bytes were approved separately.
 *     `--update-existing` is deliberately NOT implemented here.
 *   - Never an orphan. Prod must carry a product for the SKU (productPresence),
 *     or the row is refused: a plate no product can reach is a dead row.
 *   - Never an unreachable image. Every asset URL is HEAD-verified against the
 *     public store before its row is written.
 *   - Nothing is written without the release phrase for this run.
 *
 * Input is a read-only `npx convex export` of dev, because no query returns a
 * whole plate row (the page-facing ones are deliberately tiny).
 *
 *   node scripts/asset-ledger/promote-plates-to-prod.mjs --export <zip>              # dry run
 *   node scripts/asset-ledger/promote-plates-to-prod.mjs --export <zip> --families   # per-family plan
 *   node scripts/asset-ledger/promote-plates-to-prod.mjs --export <zip> --apply --ship "<phrase>"
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";

const PROD_URL = "https://precise-raccoon-123.convex.cloud";
const SHIP_PHRASE = "ship the dev plate index to production 2026-09-18";
const BATCH = 50;                       // upsertMany's own limit
const PRESENCE_BATCH = 200;             // productPresence's MAX_SKUS_PER_LOOKUP

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
const apply = flag("--apply");
const ship = value("--ship");
const exportPath = value("--export");
const limit = value("--limit") ? Number(value("--limit")) : null;

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!exportPath || !existsSync(exportPath)) throw new Error("--export <zip> is required: npx convex export --path <zip> (dev, read-only)");
if (apply && ship !== SHIP_PHRASE) throw new Error(`refusing to write: --apply needs --ship "${SHIP_PHRASE}"`);
const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
if (apply && !writeToken) throw new Error("BEST_BOTTLES_CONVEX_WRITE_TOKEN is not set");

/** Read one table's documents out of a Convex export zip. */
function tableDocs(zip, table) {
    const dir = mkdtempSync(path.join(tmpdir(), "plate-export-"));
    try {
        execFileSync("unzip", ["-o", "-q", zip, `${table}/documents.jsonl`, "-d", dir], { stdio: "pipe" });
        const file = path.join(dir, table, "documents.jsonl");
        if (!existsSync(file)) throw new Error(`export has no ${table} table`);
        return readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

/** The row shape upsertMany accepts: the document minus Convex's own fields. */
function toRow(doc) {
    const asset = (a) => a && { url: a.url, key: a.key, sha256: a.sha256, bytes: a.bytes, width: a.width, height: a.height };
    return {
        sku: doc.sku,
        websiteSku: doc.websiteSku ?? null,
        graceSku: doc.graceSku ?? null,
        familyId: doc.familyId,
        front: asset(doc.front),
        frontCapOff: asset(doc.frontCapOff) ?? null,
        thumb: asset(doc.thumb),
        thumbCapOff: asset(doc.thumbCapOff) ?? null,
        views: (doc.views ?? []).map((view) => ({
            view: view.view, cap: view.cap, source: view.source, kitSha256: view.kitSha256 ?? null,
            plate: asset(view.plate), thumb: asset(view.thumb) ?? null,
        })),
        source: {
            library: doc.source.library, path: doc.source.path,
            psdSha256: doc.source.psdSha256 ?? null, psdSha256CapOff: doc.source.psdSha256CapOff ?? null,
        },
        builder: { name: doc.builder.name, version: doc.builder.version, builtAt: doc.builder.builtAt },
        storageProvider: doc.storageProvider,
    };
}

function assetUrls(row) {
    return [row.front, row.frontCapOff, row.thumb, row.thumbCapOff, ...row.views.flatMap((v) => [v.plate, v.thumb])]
        .filter(Boolean).map((a) => a.url);
}

async function headOk(url) {
    try { const res = await fetch(url, { method: "HEAD" }); return res.ok; } catch { return false; }
}

/** Every SKU the prod index already carries. */
async function prodPlatedSkus(client) {
    const families = await client.query(api.productPlates.families, {});
    const skus = new Set();
    for (const family of families) {
        let cursor = null;
        for (;;) {
            const page = await client.query(api.productPlates.byFamily, { familyId: family.familyId, cursor, limit: 500 });
            for (const row of page.page) skus.add(row.sku);
            if (page.isDone) break;
            cursor = page.continueCursor;
        }
    }
    return { skus, familyIds: new Set(families.map((f) => f.familyId)) };
}

async function main() {
    const prod = new ConvexHttpClient(PROD_URL);
    const devPlates = tableDocs(exportPath, "productPlates");
    const devFamilies = tableDocs(exportPath, "plateFamilies");
    const onProd = await prodPlatedSkus(prod);
    console.log(`dev export: ${devPlates.length} plate rows, ${devFamilies.length} families`);
    console.log(`prod index: ${onProd.skus.size} plate rows, ${onProd.familyIds.size} families`);

    // Named holds: a SKU Jordan wants left off this release (a known scale defect,
    // a plate awaiting rework). Held rows stay on dev and are listed in the receipt.
    const held = new Set((value("--hold") ?? "").split(",").map((s) => s.trim()).filter(Boolean));
    let candidates = devPlates.filter((doc) => !onProd.skus.has(doc.sku) && !held.has(doc.sku)).map(toRow);
    if (held.size) console.log(`held by name: ${[...held].join(", ")}`);
    candidates.sort((a, b) => a.sku.localeCompare(b.sku));
    if (limit) candidates = candidates.slice(0, limit);
    console.log(`\nabsent on prod: ${candidates.length}`);

    // 1. Refuse orphans: prod must carry the product this plate belongs to.
    const presence = {};
    for (let i = 0; i < candidates.length; i += PRESENCE_BATCH) {
        const slice = candidates.slice(i, i + PRESENCE_BATCH).map((r) => r.sku);
        Object.assign(presence, await prod.query(api.productPlates.productPresence, { skus: slice }));
    }
    const orphans = candidates.filter((r) => (presence[r.sku]?.count ?? 0) === 0);
    const duplicated = candidates.filter((r) => (presence[r.sku]?.count ?? 0) > 1);
    let eligible = candidates.filter((r) => (presence[r.sku]?.count ?? 0) === 1);
    console.log(`  no product on prod (refused): ${orphans.length}`);
    console.log(`  duplicate product rows on prod (held): ${duplicated.length}`);

    // 2. Refuse anything whose bytes are not actually served.
    const broken = [];
    for (const row of eligible) {
        const urls = assetUrls(row);
        const results = await Promise.all(urls.map(headOk));
        if (results.some((ok) => !ok)) broken.push({ sku: row.sku, url: urls[results.findIndex((ok) => !ok)] });
    }
    eligible = eligible.filter((row) => !broken.some((b) => b.sku === row.sku));
    console.log(`  image not served (refused): ${broken.length}`);
    console.log(`  ready to index on prod: ${eligible.length}`);

    // Families the prod index does not know yet, needed by the rows above.
    const neededFamilies = new Set(eligible.map((r) => r.familyId));
    const missingFamilies = devFamilies
        .filter((f) => neededFamilies.has(f.familyId) && !onProd.familyIds.has(f.familyId))
        .map((f) => ({
            familyId: f.familyId, name: f.name, neckFinish: f.neckFinish, canvas: f.canvas,
            closures: f.closures, bodyMask: f.bodyMask ?? null, variantCount: f.variantCount, buildId: f.buildId,
        }));
    console.log(`  plate families to create on prod: ${missingFamilies.length}${missingFamilies.length ? " (" + missingFamilies.map((f) => f.familyId).join(", ") + ")" : ""}`);

    const byFamily = {};
    for (const row of eligible) {
        const name = devFamilies.find((f) => f.familyId === row.familyId)?.name ?? row.familyId;
        byFamily[name] = (byFamily[name] ?? 0) + 1;
    }
    if (flag("--families")) {
        console.log("\nfamily\trows");
        for (const [name, count] of Object.entries(byFamily).sort((a, b) => b[1] - a[1])) console.log(`${name}\t${count}`);
    }

    const report = {
        generatedAt: new Date().toISOString(),
        from: process.env.NEXT_PUBLIC_CONVEX_URL ?? "dev export",
        to: PROD_URL,
        applied: apply,
        counts: {
            devRows: devPlates.length, prodRowsBefore: onProd.skus.size, absentOnProd: candidates.length,
            orphansRefused: orphans.length, duplicateProductHeld: duplicated.length,
            imageNotServed: broken.length, eligible: eligible.length, familiesCreated: missingFamilies.length,
        },
        byFamily,
        bySourceLibrary: eligible.reduce((acc, r) => ({ ...acc, [r.source.library]: (acc[r.source.library] ?? 0) + 1 }), {}),
        capOffPresent: eligible.filter((r) => r.frontCapOff).length,
        eligibleSkus: eligible.map((r) => r.sku),
        heldByName: [...held],
        orphans: orphans.map((r) => r.sku),
        duplicated: duplicated.map((r) => r.sku),
        broken,
    };

    if (!apply) {
        writeFileSync("data/asset-ledger/plate-promotion-plan-2026-09-18.json", JSON.stringify(report, null, 1) + "\n");
        console.log(`\nDRY RUN. Plan written to data/asset-ledger/plate-promotion-plan-2026-09-18.json`);
        console.log(`To write: --apply --ship "${SHIP_PHRASE}"`);
        return;
    }

    if (missingFamilies.length) {
        for (let i = 0; i < missingFamilies.length; i += 20) {
            await prod.mutation(api.productPlates.upsertFamilies, { writeToken, families: missingFamilies.slice(i, i + 20) });
        }
        console.log(`families written: ${missingFamilies.length}`);
    }
    const outcomes = { inserted: 0, updated: 0, unchanged: 0, error: 0 };
    const errors = [];
    for (let i = 0; i < eligible.length; i += BATCH) {
        const slice = eligible.slice(i, i + BATCH);
        const results = await prod.mutation(api.productPlates.upsertMany, { writeToken, rows: slice });
        for (const r of results) { outcomes[r.outcome]++; if (r.outcome === "error") errors.push(r); }
        process.stdout.write(`\r  indexed ${Math.min(i + BATCH, eligible.length)}/${eligible.length}`);
    }
    console.log(`\nrows: ${outcomes.inserted} inserted, ${outcomes.updated} updated, ${outcomes.unchanged} unchanged, ${outcomes.error} error`);
    if (errors.length) console.log("errors:", JSON.stringify(errors.slice(0, 10)));
    report.outcomes = outcomes;
    report.errors = errors;
    writeFileSync("data/asset-ledger/plate-promotion-2026-09-18.json", JSON.stringify(report, null, 1) + "\n");
    console.log("receipt: data/asset-ledger/plate-promotion-2026-09-18.json");
}

main().catch((error) => { console.error(error); process.exit(1); });
