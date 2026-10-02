#!/usr/bin/env node
// Local validation by default. Publication is deliberately split into upload
// and apply; neither deploys a backend or frontend. See the release report.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import sharp from "sharp";
import { createBlobStore, verifyPublicUrl } from "./paperdoll/lib/store-blob.mjs";

const argv = process.argv.slice(2);
if (argv.includes("--help")) {
    console.log("node scripts/migrate-legacy-finish-images.mjs [--check-live | --upload | --apply | --rollback --apply] --deployment prod|dev\nDefault: verify local hashes, PNG format, dimensions and exact scope. No network or writes.\n--upload: immutable Blob uploads only. --apply: verify hosted bytes, then guarded atomic URL migration.\nExisting credentials only: BLOB_READ_WRITE_TOKEN; REGISTER_PROD_WRITE_TOKEN (prod) or BEST_BOTTLES_CONVEX_WRITE_TOKEN (dev).\nProduction publication remains held until the coordinating release is ready.");
    process.exit(0);
}
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--deployment") { i++; continue; }
    if (!["--check-live", "--upload", "--apply", "--rollback"].includes(argv[i])) throw new Error(`Unknown argument: ${argv[i]}`);
}
const upload = argv.includes("--upload"), apply = argv.includes("--apply"), rollback = argv.includes("--rollback");
const live = upload || apply || argv.includes("--check-live");
if (rollback && (!apply || upload)) throw new Error("Rollback requires --apply and cannot upload");
const deployment = argv[argv.indexOf("--deployment") + 1];
if (live && (!argv.includes("--deployment") || !["prod", "dev"].includes(deployment))) throw new Error("Live operations require --deployment prod|dev");
const target = deployment === "prod" ? "https://precise-raccoon-123.convex.cloud" : "https://helpful-elephant-638.convex.cloud";
const token = deployment === "prod" ? process.env.REGISTER_PROD_WRITE_TOKEN : process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
if (apply && !token) throw new Error("The selected deployment's existing image write token is required");
const patches = JSON.parse(await readFile("data/migrations/legacy-finish-images-2026-10-02/patches.json", "utf8"));
const manifest = JSON.parse(await readFile("data/migrations/legacy-finish-images-2026-10-02/manifest.json", "utf8"));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const unique = new Map();
if (patches.length !== 93 || new Set(patches.map(p => p.websiteSku)).size !== 93 || manifest.configurationReferences !== 1345) throw new Error("Scope changed; review the migration manifest");
for (const entry of patches) {
    const bytes = await readFile(entry.payloadFile);
    const meta = await sharp(bytes).metadata();
    const source = manifest.assets.find(a => a.legacyUrl === entry.expectedUrl);
    const expectedKey = `components/legacy-finish/${entry.sha256}.png`;
    if (!source || source.sha256 !== entry.sha256 || source.componentWebsiteSkus[0] !== entry.websiteSku
        || hash(bytes) !== entry.sha256 || bytes.length !== entry.byteLength
        || meta.format !== "png" || meta.width !== entry.width || meta.height !== entry.height
        || entry.contentType !== "image/png" || entry.blobKey !== expectedKey
        || entry.imageUrl !== `https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/${expectedKey}`) {
        throw new Error(`Invalid payload or mapping: ${entry.websiteSku}`);
    }
    unique.set(entry.sha256, { entry, bytes });
}
const receipt = { checkedAt: new Date().toISOString(), deployment: live ? deployment : null, target: live ? target : null,
    records: patches.length, configurations: manifest.configurationReferences, distinctPayloads: unique.size,
    payloadBytes: [...unique.values()].reduce((n, p) => n + p.bytes.length, 0), before: [], hosted: [], mutation: null };
async function convex(kind, path, args) {
    const res = await fetch(`${target}/api/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, args, format: "json" }) });
    const value = await res.json();
    if (!res.ok || value.status !== "success") throw new Error(`Convex ${path} failed: ${value.errorMessage ?? res.status}`);
    return value.value;
}
if (live) {
    for (const entry of patches) {
        const row = await convex("query", "products:getByWebsiteSku", { websiteSku: entry.websiteSku });
        if (!row || row.websiteSku !== entry.websiteSku || row.graceSku !== entry.graceSku || row.category !== "Component"
            || ![entry.expectedUrl, entry.imageUrl].includes(row.imageUrl)) throw new Error(`Current record changed; held: ${entry.websiteSku}`);
        receipt.before.push(row);
    }
}
// Persist the complete current image snapshot before any hosted write.
const out = resolve("output/legacy-finish-images", new Date().toISOString().replace(/[:.]/g, "-"));
if (live) { await mkdir(out, { recursive: true }); await writeFile(resolve(out, "before.json"), JSON.stringify(receipt.before, null, 2) + "\n"); }
async function verifyHosted(entry) {
    const check = await verifyPublicUrl(entry.imageUrl, { expectedBytes: entry.byteLength, expectedContentType: "image/png" });
    if (!check.ok) throw new Error(`Hosted metadata failed for ${entry.websiteSku}: ${check.problems.join(", ")}`);
    const res = await fetch(entry.imageUrl);
    if (!res.ok) throw new Error(`Hosted GET failed: ${entry.websiteSku}`);
    const bytes = Buffer.from(await res.arrayBuffer()), meta = await sharp(bytes).metadata();
    if (hash(bytes) !== entry.sha256 || meta.format !== "png" || meta.width !== entry.width || meta.height !== entry.height) throw new Error(`Hosted bytes differ: ${entry.websiteSku}`);
    receipt.hosted.push({ url: entry.imageUrl, sha256: entry.sha256, byteLength: bytes.length, width: meta.width, height: meta.height });
}
if (upload) {
    const store = createBlobStore();
    // A known deployed object proves the existing token addresses this store
    // before the first upload. Never create credentials or accept another store.
    const sentinelKey = "kits/master-parts/58165fd317cadaaed55186664e754056328839abd9cf229b479434412b052773.body.webp";
    const sentinel = await store.headObject(sentinelKey);
    if (sentinel?.url !== `https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/${sentinelKey}`) throw new Error("Existing Blob store could not be verified; no assets uploaded");
    for (const { entry, bytes } of unique.values()) {
        const result = await store.putObject(entry.blobKey, bytes, "image/png");
        if (result.url !== entry.imageUrl) throw new Error("Blob token belongs to an unexpected store; no product references changed");
        await verifyHosted(entry);
    }
}
if (apply) {
    if (rollback) {
        // Restoring old URLs is only useful while the old host still serves them.
        for (const entry of patches) {
            const res = await fetch(entry.expectedUrl);
            if (!res.ok || hash(Buffer.from(await res.arrayBuffer())) !== entry.sha256) throw new Error(`Legacy rollback source unavailable: ${entry.websiteSku}`);
        }
    } else if (!upload) {
        for (const { entry } of unique.values()) await verifyHosted(entry);
    }
    receipt.mutation = await convex("mutation", "legacyFinishImages:migrate", { writeToken: token, dryRun: false, rollback });
    for (const entry of patches) {
        const row = await convex("query", "products:getByWebsiteSku", { websiteSku: entry.websiteSku });
        if (row?.imageUrl !== (rollback ? entry.expectedUrl : entry.imageUrl)) throw new Error(`Post-write readback mismatch: ${entry.websiteSku}`);
    }
}
if (live) await writeFile(resolve(out, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify({ ...receipt, before: receipt.before.length, hosted: receipt.hosted.length, receipt: live ? resolve(out, "receipt.json") : null }, null, 2));
