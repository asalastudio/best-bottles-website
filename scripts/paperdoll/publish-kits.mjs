#!/usr/bin/env node
// Publish component kits: upload the part objects, then index one row per SKU.
//
//   node scripts/paperdoll/publish-kits.mjs                 # dry run
//   node scripts/paperdoll/publish-kits.mjs --apply
//   add --family <familyId> to limit
//
// env: NEXT_PUBLIC_CONVEX_URL, BLOB_READ_WRITE_TOKEN, BEST_BOTTLES_CONVEX_WRITE_TOKEN
//
// The same rules the plates follow. Keys are content-addressed, so a part is
// uploaded once however many SKUs reference it and re-publishing never
// overwrites. A row is written only after its object's public URL answers 200
// with the right type and length, and only for a SKU that already carries a
// published plate — a kit without its plate is a stage that cannot fall back.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve, dirname } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import { createBlobStore, verifyPublicUrl } from "./lib/store-blob.mjs";

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const onlyFamily = argv.includes("--family") ? argv[argv.indexOf("--family") + 1] : null;
const KITS = resolve("dist/paper-doll/kits");
const PLATES = resolve("dist/paper-doll/legacy/cylinder-9ml-17-415");
const BUILDER = { name: "publish-kits.mjs", version: "1.0.0" };

const asBounds = ([left, top, right, bottom]) => ({ left, top, right, bottom });

async function main() {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) fail("NEXT_PUBLIC_CONVEX_URL is not set");
    const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (apply && !writeToken) fail("BEST_BOTTLES_CONVEX_WRITE_TOKEN is not set");
    const convex = new ConvexHttpClient(convexUrl);
    console.log(`${apply ? "PUBLISH" : "DRY RUN"} → ${convexUrl}`);

    const manifest = JSON.parse(await readFile(join(KITS, "manifest.json"), "utf8"));
    let rows = manifest.rows.filter((r) => r.publishable);
    if (onlyFamily) rows = rows.filter((r) => r.familyId === onlyFamily);
    if (!rows.length) fail(`no publishable kits${onlyFamily ? ` for ${onlyFamily}` : ""}`);

    // a kit may only be indexed for a SKU whose plate is already published
    const skus = [...new Set(rows.flatMap((r) => [r.websiteSku, r.graceSku].filter(Boolean)))];
    const plates = {};
    for (let i = 0; i < skus.length; i += 200) {
        const page = await convex.query(api.productPlates.forSkus, { skus: skus.slice(i, i + 200) });
        Object.assign(plates, page.plates);
    }
    const withPlate = rows.filter((r) => plates[r.websiteSku] || plates[r.graceSku]);
    const withoutPlate = rows.filter((r) => !(plates[r.websiteSku] || plates[r.graceSku]));

    const parts = new Map();          // file -> { key, bytes, sha256 }
    for (const row of withPlate) {
        for (const part of row.parts) {
            if (parts.has(part.image)) continue;
            parts.set(part.image, { file: part.image, key: part.storeKey, sha256: part.sha256, bytes: part.bytes });
        }
    }

    console.log(`\n${withPlate.length} kits ready, ${withoutPlate.length} held (no published plate)`);
    console.log(`${parts.size} distinct part objects for ${withPlate.reduce((n, r) => n + r.parts.length, 0)} part references`);
    if (!apply) {
        console.log(`\nexample part key: ${[...parts.values()][0]?.key}`);
        for (const r of withoutPlate.slice(0, 8)) console.log(`   -- ${r.websiteSku}: no published plate`);
        console.log("\nre-run with --apply to upload, verify and index.");
        return;
    }

    // ---- upload every part once
    const store = createBlobStore();
    const uploaded = { new: 0, existed: 0, verified: 0 };
    const assets = new Map();
    for (const part of parts.values()) {
        const path = join(KITS, part.file.startsWith("..") ? part.file.replace(/^\.\.\//, "") : part.file);
        const abs = part.file.startsWith("..") ? join(KITS, part.file) : join(KITS, part.file);
        const bytes = await readFile(abs).catch(() => readFile(path));
        const sha256 = createHash("sha256").update(bytes).digest("hex");
        if (sha256 !== part.sha256) fail(`hash drift for ${part.file}`);
        const { url, existed } = await store.putObject(part.key, bytes, "image/webp");
        existed ? uploaded.existed++ : uploaded.new++;
        const verdict = await verifyPublicUrl(url, { expectedBytes: bytes.length, expectedContentType: "image/webp" });
        if (!verdict.ok) fail(`${part.key}: ${verdict.problems.join("; ")}`);
        uploaded.verified++;
        assets.set(part.file, { url, key: part.key, sha256, bytes: bytes.length, width: 1000, height: 1100 });
    }
    console.log(`parts: uploaded ${uploaded.new}, existed ${uploaded.existed}, verified ${uploaded.verified}`);

    // ---- one row per SKU
    const indexRows = [];
    for (const row of withPlate) {
        const plateBytes = await readFile(join(PLATES, `${row.graceSku}.webp`));
        indexRows.push({
            sku: row.websiteSku,
            websiteSku: row.websiteSku,
            graceSku: row.graceSku,
            familyId: row.familyId,
            plateSha256: createHash("sha256").update(plateBytes).digest("hex"),
            canvas: row.canvas,
            anchors: row.anchors,
            completeness: row.completeness,
            parts: row.parts.map((p) => ({
                slot: p.slot === "roller" ? "roller" : p.slot,
                variantKey: p.variantKey ?? null,
                zOrder: p.zOrder,
                explodeIndex: p.explodeIndex,
                bounds: asBounds(p.bounds),
                assembled: p.assembled,
                exploded: p.exploded,
                image: assets.get(p.image),
                image2x: null,
                mask: null,
                derivation: "madison",
            })),
            three: row.three,
            source: { library: row.source.library, path: row.source.path, releaseVersion: null },
            builder: { ...BUILDER, builtAt: Date.now() },
            storageProvider: store.provider,
        });
    }

    let written = 0, unchanged = 0;
    const errors = [];
    for (let i = 0; i < indexRows.length; i += 25) {
        const results = await convex.mutation(api.productKits.upsertMany, { writeToken, rows: indexRows.slice(i, i + 25) });
        for (const r of results) {
            if (r.outcome === "error") errors.push(r);
            else if (r.outcome === "unchanged") unchanged++;
            else written++;
        }
    }
    console.log(`rows: written ${written}, unchanged ${unchanged}, errors ${errors.length}`);
    for (const e of errors.slice(0, 10)) console.log(`   !! ${e.sku}: ${e.error}`);
    console.log(errors.length ? "\nFINISHED WITH ERRORS" : "\nOK — now run scripts/paperdoll/verify.mjs");
    process.exit(errors.length ? 1 : 0);
}

function fail(message) {
    console.error(`publish-kits: ${message}`);
    process.exit(1);
}

main().catch((error) => { console.error(error); process.exit(1); });
