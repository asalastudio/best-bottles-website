import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createBlobStore, verifyPublicUrl } from "./lib/store-blob.mjs";

// Extend the approved release by exactly the four previously reviewed small sprays.
// Original media is content-addressed and never overwritten or deleted.
const directory = "docs/reviews/hosted-small-sprayers-2026-11-01";
const sourceFile = "public/local-kits/small-sprayers-2026-10-31/kits.json";
const manifestFile = "src/lib/paper-doll/approved-kits.generated.json";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const small = JSON.parse(fs.readFileSync(sourceFile));
const previous = JSON.parse(fs.readFileSync(manifestFile));
const expected = ["GBSpry3mlClBlk", "GBSpry3mlClWht", "GBSpry4mlClBlk", "GBSpry4mlClWh"].sort();
if (JSON.stringify(Object.keys(small.rows).sort()) !== JSON.stringify(expected)) throw Error("Unexpected small-sprayer scope");
const priorRows = Object.fromEntries(Object.entries(previous.rows).filter(([sku]) => !expected.includes(sku)));
if (Object.keys(priorRows).length !== 267) throw Error("Existing approved release changed; reconcile before extending");
const assets = new Map();
for (const kit of Object.values(small.rows)) for (const part of kit.parts) {
    if (part.image2x || part.mask) throw Error("Additional media needs explicit handling");
    for (const image of [part.image, part.detached?.image].filter(Boolean)) {
    const url = image.url;
    if (!url.startsWith("/local-kits/")) throw Error("Unexpected small-sprayer source " + url);
    const file = "public" + url, bytes = fs.readFileSync(file), sha256 = hash(bytes), extension = path.extname(file).slice(1);
    const contentType = { svg: "image/svg+xml", png: "image/png" }[extension];
    if (!contentType) throw Error("Unexpected source format " + file);
    if (image.sha256 && image.sha256 !== sha256) throw Error("Source hash mismatch " + file);
    assets.set(url, { file, sha256, bytes: bytes.length, contentType, key: "reviewed-master-media/2026-11-01/" + sha256 + "." + extension });
    }
}
fs.mkdirSync(directory, { recursive: true });
const plan = { sourceFile, sourceVersion: small.version, sourceSha256: hash(fs.readFileSync(sourceFile)), priorConfigurations: Object.keys(priorRows).length, configurations: 271, addedSkus: expected, assets: Object.fromEntries(assets), approval: "Owner requested the previously corrected 3.3/4 ml glass be brought live after finding it missing from the hosted release." };
fs.writeFileSync(directory + "/upload-plan.json", JSON.stringify(plan, null, 2) + "\n");
console.log(JSON.stringify({ addedSkus: expected, assets: assets.size, bytes: [...assets.values()].reduce((sum, asset) => sum + asset.bytes, 0), apply: process.argv.includes("--apply") }));
if (!process.argv.includes("--apply")) process.exit(0);
const store = createBlobStore(), receipt = {};
for (const [sourceUrl, asset] of assets) {
    const uploaded = await store.putObject(asset.key, fs.readFileSync(asset.file), asset.contentType);
    const metadata = await verifyPublicUrl(uploaded.url, { expectedBytes: asset.bytes, expectedContentType: asset.contentType });
    const problems = metadata.problems.filter(problem => !problem.startsWith("content-length 0 !="));
    if (problems.length) throw Error(problems.join("; "));
    const response = await fetch(uploaded.url);
    if (!response.ok || hash(Buffer.from(await response.arrayBuffer())) !== asset.sha256) throw Error("Public hash verification failed " + sourceUrl);
    receipt[sourceUrl] = { ...asset, ...uploaded, verified: true };
    fs.writeFileSync(directory + "/asset-receipt.json", JSON.stringify(receipt, null, 2) + "\n");
    console.log("VERIFIED " + Object.keys(receipt).length + "/" + assets.size);
}
for (const kit of Object.values(small.rows)) for (const part of kit.parts) {
    for (const image of [part.image, part.detached?.image].filter(Boolean)) {
        const hosted = receipt[image.url];
        Object.assign(image, { url: hosted.url, key: hosted.key, sha256: hosted.sha256, bytes: hosted.bytes });
    }
}
const rows = { ...priorRows, ...small.rows }, version = hash(JSON.stringify(rows)).slice(0, 16);
fs.writeFileSync(manifestFile, JSON.stringify({ ...previous, version, rows }) + "\n");
fs.writeFileSync("src/lib/paper-doll/approved-kit-index.json", JSON.stringify({ version, skus: Object.keys(rows).sort() }) + "\n");
fs.writeFileSync(directory + "/release-manifest.json", JSON.stringify({ version, configurations: 271, addedSkus: expected, preservedPriorRecipesSha256: hash(JSON.stringify(priorRows)), sourceSha256: plan.sourceSha256, productionDataMutated: false }, null, 2) + "\n");
console.log("HOSTED MANIFEST " + version);
