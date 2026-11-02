import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import nextEnv from '@next/env';
import { createBlobStore, verifyPublicUrl } from './lib/store-blob.mjs';
nextEnv.loadEnvConfig(process.cwd(), true);
const dir = 'docs/reviews/vial2-matched-2026-11-01';
const reviewFile = 'public/local-kits/vial2-matched-2026-11-01/kits.json';
const sourceFile = 'public/local-kits/vial2-matched-2026-11-01/source-kits.json';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const recipeHash = value => hash(JSON.stringify(canonical(value)));
const review = read(sourceFile), approval = read(dir + '/visual-approval.json'), prior = read(dir + '/prior-recipe-hashes.json');
const skus = ['GBVAmb2BlackCap', 'GBVAmb2WhtCap', 'GBVialClr2mlBlackCap', 'GBVialClr2mlWhtCap'];
assert.deepEqual(Object.keys(review.rows).sort(), skus);
const manifestFile = 'src/lib/paper-doll/approved-kits.generated.json', manifest = read(manifestFile);
const revisedTulip = read('public/local-kits/tulip6-glass-depth-2026-11-01/kits.json').rows;
const tulipBefore = read('docs/reviews/tulip6-glass-depth-2026-11-01/before-kits.json').rows;
assert.equal(Object.keys(revisedTulip).length, 7);
const unchanged = {};
for (const [sku, digest] of Object.entries(prior.recipes)) {
    if (revisedTulip[sku]) { assert.equal(recipeHash(tulipBefore[sku]), digest); continue; }
    assert.equal(recipeHash(manifest.rows[sku]), digest, 'Unrelated recipe changed: ' + sku);
    unchanged[sku] = manifest.rows[sku];
}
assert.equal(Object.keys(unchanged).length, 427);
const existing = new Map(Object.values(manifest.rows).flatMap(k => k.parts.flatMap(p => [p.image, p.detached?.image].filter(Boolean))).filter(i => i.sha256 && i.url.startsWith('https://')).map(i => [i.sha256, i.url]));
const assets = new Map();
for (const kit of Object.values(review.rows)) for (const part of kit.parts) {
    assert.ok(!part.image2x && !part.mask, 'Unexpected secondary image');
    const image = part.image;
    assert.ok(image.url.startsWith('/local-kits/vial2-matched-2026-11-01/'), 'Source recipes must retain local immutable originals');
    const file = 'public' + image.url, bytes = fs.readFileSync(file), sha256 = hash(bytes);
    assert.equal(image.sha256, sha256);
    if (part.slot === 'body') assert.ok(Object.values(approval.images).some(a => a.sha256 === sha256), 'Body approval mismatch');
    const ext = path.extname(file).slice(1);
    assets.set(image.url, { file, sha256, bytes: bytes.length, contentType: ext === 'webp' ? 'image/webp' : 'image/png', key: 'reviewed-master-media/2026-11-01/' + sha256 + '.' + ext, reuse: existing.get(sha256) ?? null });
}
const plan = { skus, approvedImageHashes: approval.images, assets: Object.fromEntries(assets), preservedRecipeCount: 427, revisedTulipSkus: Object.keys(revisedTulip).sort(), productionDataMutated: false };
fs.writeFileSync(dir + '/upload-plan.json', JSON.stringify(plan, null, 2) + '\n');
console.log(JSON.stringify({ skus: skus.length, assets: assets.size, apply: process.argv.includes('--apply') }));
if (!process.argv.includes('--apply')) process.exit(0);
const store = createBlobStore(), receipt = {};
for (const [source, asset] of assets) {
    const uploaded = asset.reuse ? { url: asset.reuse, existed: true } : await store.putObject(asset.key, fs.readFileSync(asset.file), asset.contentType);
    const response = await fetch(uploaded.url); assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(hash(bytes), asset.sha256);
    const metadata = await verifyPublicUrl(uploaded.url, { expectedBytes: asset.bytes, expectedContentType: asset.contentType });
    assert.deepEqual(metadata.problems.filter(p => !p.startsWith('content-length 0 !=')), []);
    receipt[source] = { ...asset, ...uploaded, verified: true };
    console.log('VERIFIED ' + asset.sha256);
}
for (const kit of Object.values(review.rows)) for (const part of kit.parts) {
    const hosted = receipt[part.image.url];
    if (hosted) Object.assign(part.image, { url: hosted.url, key: hosted.key, sha256: hosted.sha256, bytes: hosted.bytes });
}
Object.assign(manifest.rows, review.rows, revisedTulip);
manifest.version = hash(JSON.stringify(manifest.rows)).slice(0, 16);
assert.equal(Object.keys(manifest.rows).length, 438);
assert.ok(!JSON.stringify(manifest.rows).includes('"url":"/local-kits/'));
fs.writeFileSync(manifestFile, JSON.stringify(manifest) + '\n');
fs.writeFileSync('src/lib/paper-doll/approved-kit-index.json', JSON.stringify({ version: manifest.version, skus: Object.keys(manifest.rows).sort() }) + '\n');
fs.writeFileSync(reviewFile, JSON.stringify(review, null, 2) + '\n');
fs.writeFileSync(dir + '/asset-receipt.json', JSON.stringify(receipt, null, 2) + '\n');
fs.writeFileSync(dir + '/release-manifest.json', JSON.stringify({ version: manifest.version, configurations: 438, addedSkus: skus, revisedTulipSkus: plan.revisedTulipSkus, preservedRecipes: 427, preservedRecipeSha256: recipeHash(unchanged), approvedBodies: approval.images, productionDataMutated: false, deployed: false }, null, 2) + '\n');
console.log('HOSTED MANIFEST ' + manifest.version);
