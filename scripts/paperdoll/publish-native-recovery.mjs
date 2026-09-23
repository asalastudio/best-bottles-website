#!/usr/bin/env node
/** Release exact, source-audited native kit/plate pairs. Dry-run by default.
 * Requires scoped before-images (explicit absence for inserts); originals and heroes stay unchanged.
 * --release DIR --target URL [--apply | --rollback]
 * Credentials are supplied through the environment, never stored in receipts.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { ConvexHttpClient } from "convex/browser";
import { createBlobStore, verifyPublicUrl } from "./lib/store-blob.mjs";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const read = async (p) => JSON.parse(await fs.readFile(p, "utf8"));
const save = async (p, data) =>
  fs.writeFile(p, JSON.stringify(data, null, 2) + "\n");
const pick = (row, keys) => Object.fromEntries(keys.map((k) => [k, row[k]]));
const plateKeys = [
  "sku",
  "websiteSku",
  "graceSku",
  "familyId",
  "front",
  "frontCapOff",
  "thumb",
  "thumbCapOff",
  "views",
  "source",
  "builder",
  "storageProvider",
];
const kitKeys = [
  "sku",
  "websiteSku",
  "graceSku",
  "familyId",
  "plateSha256",
  "canvas",
  "anchors",
  "completeness",
  "parts",
  "three",
  "source",
  "builder",
  "storageProvider",
];
export function validateRecovery(row, product) {
  if (
    row.status !== "candidate" ||
    !row.gates?.sourceParity?.ok ||
    !row.gates.alphaAndCanvas
  )
    throw Error("Source gates failed: " + row.sku);
  if (
    !(
      row.source?.review ||
      row.source?.registrationReview ||
      row.source?.sourceCrosswalk ||
      row.source?.overcapReview
    ) ||
    !row.layerEvidence?.length
  )
    throw Error("Missing source review: " + row.sku);
  if (
    row.sku !== row.websiteSku ||
    product.websiteSku !== row.sku ||
    product.graceSku !== row.graceSku
  )
    throw Error("SKU mismatch: " + row.sku);
  for (const [key, value] of Object.entries(row.source.identity))
    if (product[key] !== value)
      throw Error(`Identity drift ${row.sku}: ${key}`);
  if (
    !row.parts.some((p) => p.slot === "body") ||
    row.canvas.width !== 1000 ||
    row.canvas.height !== 1100
  )
    throw Error("Unsupported kit canvas/body: " + row.sku);
  if (new Set(row.parts.map((p) => p.slot)).size !== row.parts.length)
    throw Error("Duplicate part slots: " + row.sku);
}
export function recoveryOperation(entry, oldPlate, oldKit) {
  if (entry.operation === "insert") {
    if (oldPlate || oldKit) throw Error("Insertion requires absent plate AND kit backups: " + entry.sku);
    return "insert";
  }
  if (entry.operation && entry.operation !== "update") throw Error("Unknown recovery operation");
  if (!oldPlate) throw Error("Missing plate backup; insertion must be explicit: " + entry.sku);
  return "update";
}
export function assertPlateUnchanged(old, live) {
  if (!old && !live) return;
  if (
    !old ||
    !live ||
    old.front.url !== live.image ||
    (old.frontCapOff?.url ?? null) !== live.imageCapOff ||
    old.thumb.url !== live.thumb ||
    (old.thumbCapOff?.url ?? null) !== live.thumbCapOff
  )
    throw Error("Published plate drift: " + (old?.sku ?? "missing"));
}
const stable = (value) =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
export function assertKitUnchanged(old, plate, live) {
  const keys = [
    "sku",
    "familyId",
    "plateSha256",
    "canvas",
    "anchors",
    "completeness",
    "parts",
    "three",
  ];
  const expected =
    old && plate && old.plateSha256 === plate.front.sha256 ? pick(old, keys) : null;
  if (
    live?.conflicts?.length ||
    stable(expected) !== stable(live ? pick(live, keys) : null)
  )
    throw Error("Published kit drift: " + (plate?.sku ?? "new insertion"));
}
export async function run(args = process.argv.slice(2)) {
  if (args.includes("--apply") && args.includes("--rollback"))
    throw Error("Choose apply or rollback, never both");
  const value = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
  if (!value("--release") || !value("--target"))
    throw Error("--release and explicit --target required");
  const dir = path.resolve(value("--release")),
    target = value("--target");
  const scope = await read(path.join(dir, "scope.json"));
  if (target !== scope.target) throw Error("Target differs from scoped backup");
  const beforePlates = await read(path.join(dir, "productPlates-before.json"));
  const beforeKits = await read(path.join(dir, "productKits-before.json"));
  if ([beforePlates, beforeKits].some((x) => x.target !== target))
    throw Error("Backup target mismatch");
  const skus = scope.rows.map((r) => r.sku);
  if (new Set(skus).size !== skus.length || !skus.length || skus.length > 50)
    throw Error("Invalid scope");
  const oldPlates = new Map(),
    oldKits = new Map();
  for (const [rows, map] of [
    [beforePlates.rows, oldPlates],
    [beforeKits.rows, oldKits],
  ])
    for (const row of rows) {
      if (map.has(row.sku)) throw Error("Duplicate index " + row.sku);
      map.set(row.sku, row);
    }
  for (const map of [oldPlates, oldKits])
    if ([...map.keys()].some(sku => !skus.includes(sku))) throw Error("Backup contains out-of-scope SKU");
  const operations = new Map(scope.rows.map(entry => [entry.sku,
    recoveryOperation(entry, oldPlates.get(entry.sku), oldKits.get(entry.sku))]));
  const client = new ConvexHttpClient(target),
    writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
  const mutate = async (name, rows) => {
    const results = await client.mutation(name, { writeToken, rows });
    if (results.some((r) => r.outcome === "error"))
      throw Error(JSON.stringify(results));
    return results;
  };
  if (args.includes("--rollback")) {
    if (!writeToken) throw Error("Write token required");
    const payload = await read(path.join(dir, "publication-payload.json"));
    if (payload.target !== target || payload.rows.length !== skus.length ||
      new Set(payload.rows.map(row => row.sku)).size !== skus.length ||
      payload.rows.some(row => !operations.has(row.sku) || row.plate?.sku !== row.sku || row.kit?.sku !== row.sku)) throw Error("Rollback payload scope mismatch");
    const rollback = [];
    for (const row of payload.rows) {
      if (operations.get(row.sku) === "insert") {
        await client.mutation("nativeMediaRelease:rollbackInsertedPair", {
          writeToken, plate: row.plate, kit: row.kit,
        });
        rollback.push(row.sku);
        await save(path.join(dir, "rollback-receipt.json"), { target, restored: rollback, at: new Date().toISOString() });
        continue;
      }
      const live = (
        await client.query("productPlates:forSkus", { skus: [row.sku] })
      ).plates[row.sku];
      const original = oldPlates.get(row.sku);
      if (
        live?.image !== row.plate.front.url &&
        live?.image !== original.front.url
      )
        throw Error("Later release detected; refusing rollback " + row.sku);
      const currentPlate =
        live.image === row.plate.front.url ? row.plate : original;
      assertPlateUnchanged(currentPlate, live);
      const liveKit = await client.query("productKits:forSku", {
        websiteSku: row.sku,
        graceSku: row.kit.graceSku,
      });
      assertKitUnchanged(
        currentPlate === row.plate ? row.kit : oldKits.get(row.sku),
        currentPlate,
        liveKit,
      );
      await mutate("productPlates:upsertMany", [pick(original, plateKeys)]);
      const prior = oldKits.get(row.sku);
      if (prior) await mutate("productKits:upsertMany", [pick(prior, kitKeys)]);
      // A newly inserted kit is retained as an inactive candidate: its plate hash
      // no longer matches, so productKits.forSku returns null. No destructive delete.
      rollback.push(row.sku);
      await save(path.join(dir, "rollback-receipt.json"), {
        target,
        restored: rollback,
        at: new Date().toISOString(),
      });
    }
    console.log("Restored", rollback.length, "plate/kit pairs");
    return;
  }
  const presence = await client.query("productPlates:productPresence", {
    skus,
  });
  for (const sku of skus)
    if (presence[sku]?.count !== 1)
      throw Error("Catalog SKU not unique: " + sku);
  const assets = new Map(),
    prepared = [],
    sources = new Map();
  async function add(bytes, key, width, height) {
    const sha256 = hash(bytes);
    if (!key.includes(sha256)) throw Error("Non-addressed key");
    const ref = { key, sha256, bytes: bytes.length, width, height };
    assets.set(key, { ...ref, data: bytes });
    return ref;
  }
  async function validateSource(source) {
    if (!sources.has(source.path))
      sources.set(source.path, hash(await fs.readFile(source.path)));
    if (sources.get(source.path) !== source.sha256)
      throw Error("Source hash drift " + source.path);
  }
  const manifests = new Map();
  for (const entry of scope.rows) {
    const root = path.resolve(entry.batch, "kits");
    if (!manifests.has(root))
      manifests.set(root, await read(path.join(root, "manifest.json")));
    const matches = manifests.get(root).rows.filter((r) => r.sku === entry.sku);
    if (matches.length !== 1)
      throw Error("Ambiguous manifest SKU " + entry.sku);
    const r = matches[0];
    const lookup = await client.query("products:lookupSku", { sku: r.sku });
    const product = lookup?.product;
    if (!product) throw Error("Missing exact product " + r.sku);
    validateRecovery(r, product);
    for (const side of ["on", "off"]) await validateSource(r.source[side]);
    const kitParts = [];
    for (const p of r.parts) {
      const file = path.resolve(root, p.image);
      if (!file.startsWith(root + path.sep)) throw Error("Part path escape");
      const bytes = await fs.readFile(file);
      if (hash(bytes) !== p.sha256 || bytes.length !== p.bytes)
        throw Error("Part hash/length drift " + r.sku);
      const meta = await sharp(bytes).metadata();
      if (
        meta.format !== "webp" ||
        !meta.hasAlpha ||
        meta.width !== 1000 ||
        meta.height !== 1100
      )
        throw Error("Invalid transparent part " + r.sku);
      kitParts.push({
        ...pick(p, [
          "slot",
          "variantKey",
          "zOrder",
          "explodeIndex",
          "bounds",
          "assembled",
          "exploded",
          "derivation",
        ]),
        image: await add(bytes, p.storeKey, p.width, p.height),
        image2x: null,
        mask: null,
      });
    }
    const on = await fs.readFile(path.join(root, r.sku + ".front-on.webp")),
      off = await fs.readFile(path.join(root, r.sku + ".front-off.webp"));
    if (hash(on) !== r.plateSha256)
      throw Error("Kit/plate hash mismatch " + r.sku);
    const plateAssets = {};
    for (const [name, bytes] of [
      ["front", on],
      ["frontCapOff", off],
    ]) {
      const meta = await sharp(bytes).metadata();
      if (meta.width !== 1000 || meta.height !== 1100 || meta.format !== "webp")
        throw Error("Invalid plate canvas");
      const cap = name === "front" ? "on" : "off";
      plateAssets[name] = await add(
        bytes,
        `plates/${r.familyId}/${r.sku}/${hash(bytes)}.front-${cap}-1000x1100.webp`,
        1000,
        1100,
      );
      const thumb = await sharp(bytes)
        .resize(250, 275)
        .webp({ quality: 90 })
        .toBuffer();
      plateAssets[name === "front" ? "thumb" : "thumbCapOff"] = await add(
        thumb,
        `plates/${r.familyId}/${r.sku}/${hash(thumb)}.front-${cap}-250x275.webp`,
        250,
        275,
      );
    }
    const builder = {
      name: "publish-native-recovery.mjs",
      version: "1.1.0",
      builtAt: Date.now(),
    };
    const shared = {
      sku: r.sku,
      websiteSku: r.sku,
      graceSku: r.graceSku,
      familyId: r.familyId,
      builder,
      storageProvider: "vercel-blob",
    };
    const master =
      "/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master/";
    const library = r.source.on.path.startsWith(master)
      ? "master"
      : "desktop-master";
    prepared.push({
      sku: r.sku,
      identity: r.source.identity,
      operation: operations.get(r.sku),
      plate: {
        ...shared,
        ...plateAssets,
        views: (oldPlates.get(r.sku)?.views ?? []).filter((v) => v.source === "photo"),
        source: {
          library,
          path: r.source.on.path,
          psdSha256: r.source.on.sha256,
          psdSha256CapOff: r.source.off.sha256,
        },
      },
      kit: {
        ...shared,
        ...pick(r, [
          "plateSha256",
          "canvas",
          "anchors",
          "completeness",
          "three",
        ]),
        parts: kitParts,
        source: {
          library,
          path: r.source.on.path,
          releaseVersion:
            "component-recovery-2026-09-22:" +
            hash(Buffer.from(JSON.stringify(r.source))),
        },
      },
    });
  }
  // Finish every source/identity gate before uploading any media or changing indexes.
  for (let i = 0; i < skus.length; i += 200) {
    const live = await client.query("productPlates:forSkus", {
      skus: skus.slice(i, i + 200),
    });
    if (live.conflicts.length) throw Error("Conflicting plates");
    for (const sku of skus.slice(i, i + 200))
      assertPlateUnchanged(oldPlates.get(sku), live.plates[sku]);
  }
  const currentKits = await client.query("productKits:forSkus", {
    pairs: skus.map((sku) => ({
      websiteSku: sku,
      graceSku: prepared.find(row => row.sku === sku).kit.graceSku,
    })),
  });
  for (const sku of skus)
    assertKitUnchanged(oldKits.get(sku), oldPlates.get(sku), currentKits[sku]);
  const insertions = prepared.filter(row => row.operation === "insert");
  // This query also catches unpublished kits and Grace aliases hidden from storefront queries.
  // It must be deployed before an insertion release. Dry-run reports unavailable capability honestly.
  let insertionIndexCheck = "not_needed";
  if (insertions.length) {
    try {
      await client.query("nativeMediaRelease:checkInsertions", {
        rows: insertions.map(row => ({ sku: row.sku, graceSku: row.kit.graceSku })),
      });
      insertionIndexCheck = "passed";
    } catch (error) {
      if (args.includes("--apply")) throw error;
      // A production backend may redact missing-function errors. Never treat an
      // unavailable check (including a network error) as proof of index absence.
      insertionIndexCheck = "blocked_remote_index_check";
      console.warn("Insertion index check not cleared:", error.message);
    }
  }
  const plan = {
    target,
    insertionIndexCheck,
    readyToApply: insertionIndexCheck !== "blocked_remote_index_check",
    insertions: insertions.map(row => row.sku),
    at: new Date().toISOString(),
    skus,
    assets: assets.size,
    sourceFiles: sources.size,
    rawPlateBodyScale:
      "Source registration retained; UI framing remains capacity-specific.",
    held: scope.held ?? [],
  };
  await save(path.join(dir, "preflight.json"), plan);
  console.log(
    "Preflight:",
    skus.length,
    "exact SKUs,",
    assets.size,
    "assets,",
    sources.size,
    "hashed sources",
  );
  if (!args.includes("--apply")) {
    if (!plan.readyToApply) process.exitCode = 2;
    return;
  }
  if (!writeToken) throw Error("Write token required");
  const store = createBlobStore(),
    locations = new Map(),
    receipt = {
      target,
      startedAt: new Date().toISOString(),
      assets: [],
      rows: [],
    };
  const queue = [...assets.values()];
  let next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < queue.length) {
        const asset = queue[next++];
        const uploaded = await store.putObject(
          asset.key,
          asset.data,
          "image/webp",
        );
        const verdict = await verifyPublicUrl(uploaded.url, {
          expectedBytes: asset.bytes,
          expectedContentType: "image/webp",
        });
        if (!verdict.ok) throw Error(verdict.problems.join("; "));
        const delivered = await fetch(uploaded.url);
        if (
          !delivered.ok ||
          hash(Buffer.from(await delivered.arrayBuffer())) !== asset.sha256
        )
          throw Error("Public bytes mismatch");
        locations.set(asset.key, uploaded.url);
        receipt.assets.push({
          key: asset.key,
          sha256: asset.sha256,
          url: uploaded.url,
        });
      }
    }),
  );
  const materialize = (ref) => ({ ...ref, url: locations.get(ref.key) });
  for (const r of prepared) {
    for (const key of ["front", "frontCapOff", "thumb", "thumbCapOff"])
      r.plate[key] = materialize(r.plate[key]);
    for (const p of r.kit.parts) p.image = materialize(p.image);
  }
  await save(path.join(dir, "publication-payload.json"), {
    target,
    rows: prepared,
  });
  await save(path.join(dir, "publication-receipt.json"), receipt);
  for (const row of prepared) {
    const live = (
      await client.query("productPlates:forSkus", { skus: [row.sku] })
    ).plates[row.sku];
    assertPlateUnchanged(oldPlates.get(row.sku), live);
    const liveKit = await client.query("productKits:forSku", {
      websiteSku: row.sku,
      graceSku: row.kit.graceSku,
    });
    assertKitUnchanged(oldKits.get(row.sku), oldPlates.get(row.sku), liveKit);
    if (row.operation === "insert") {
      await client.mutation("nativeMediaRelease:insertPair", {
        writeToken, plate: row.plate, kit: row.kit, identity: row.identity,
      });
    } else {
      // Existing kit stays hidden until its matching plate is installed.
      await mutate("productKits:upsertMany", [row.kit]);
      await mutate("productPlates:upsertMany", [row.plate]);
    }
    const served = await client.query("productKits:forSku", {
      websiteSku: row.sku,
      graceSku: row.kit.graceSku,
    });
    if (
      !served ||
      served.plateSha256 !== row.kit.plateSha256 ||
      served.parts.length !== row.kit.parts.length
    )
      throw Error("Published pair verification failed " + row.sku);
    receipt.rows.push(row.sku);
    await save(path.join(dir, "publication-receipt.json"), receipt);
    console.log(
      "Published",
      receipt.rows.length + "/" + prepared.length,
      row.sku,
    );
  }
  receipt.completedAt = new Date().toISOString();
  await save(path.join(dir, "publication-receipt.json"), receipt);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  run().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
