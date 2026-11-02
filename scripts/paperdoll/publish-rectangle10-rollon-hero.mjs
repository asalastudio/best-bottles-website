import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import nextEnv from '@next/env';
import { createBlobStore, verifyPublicUrl } from './lib/store-blob.mjs';

nextEnv.loadEnvConfig(process.cwd(), true);
const dir = 'docs/reviews/rectangle10-rollon-hero-2026-11-01';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const recipeHash = value => hash(JSON.stringify(canonical(value)));
const source = read(dir + '/before-kits.json');
const prior = read(dir + '/preserved-recipes.json');
const file = 'src/lib/paper-doll/approved-kits.generated.json';
const manifest = read(file);
for (const [sku, digest] of Object.entries(prior.recipes)) assert.equal(recipeHash(manifest.rows[sku]), digest, sku);
const rows = structuredClone(source.rows);
assert.equal(Object.keys(rows).length, 18);
for (const [sku, kit] of Object.entries(rows)) {
    assert.match(sku, /^GBRect10(?:MtlRoll|Roll)/);
    assert.equal(kit.sku, sku);
    assert.equal(kit.register.bodyId, 'footed-rectangle-10ml-13-415');
    assert.deepEqual(kit.parts.map(part => part.slot).sort(), ['body', 'cap', 'roller']);
}
assert.equal(new Set(Object.values(rows).map(kit => kit.parts.find(part => part.slot === 'body').image.sha256)).size, 1);
const existing = new Map(Object.values(manifest.rows).flatMap(kit => kit.parts.flatMap(part => [part.image, part.detached?.image].filter(Boolean)))
    .filter(image => image.sha256 && image.url.startsWith('https://')).map(image => [image.sha256, image.url]));
const assets = new Map();
for (const kit of Object.values(rows)) for (const part of kit.parts) {
    assert.ok(!part.image2x && !part.mask && !part.detached, 'Unexpected secondary media: ' + kit.sku);
    const image = part.image, local = 'public' + image.url;
    assert.ok(image.url.startsWith('/local-kits/'));
    const bytes = fs.readFileSync(local), sha256 = hash(bytes), ext = path.extname(local).slice(1);
    assert.equal(sha256, image.sha256);
    assert.ok(['png', 'svg'].includes(ext));
    assets.set(image.url, { file: local, sha256, bytes: bytes.length, contentType: ext === 'svg' ? 'image/svg+xml' : 'image/png',
        key: 'reviewed-master-media/2026-11-01/' + sha256 + '.' + ext, reuse: existing.get(sha256) ?? null });
}
fs.writeFileSync(dir + '/upload-plan.json', JSON.stringify({ skus: Object.keys(rows).sort(), assets: Object.fromEntries(assets),
    preservedRecipes: prior.count, sourcePixelsChanged: false, geometryChanged: false, productionDataMutated: false }, null, 2) + '\n');
console.log(JSON.stringify({ configurations: Object.keys(rows).length, sourceAssets: assets.size,
    newUploads: [...assets.values()].filter(asset => !asset.reuse).length, apply: process.argv.includes('--apply') }));
if (!process.argv.includes('--apply')) process.exit(0);
const store = createBlobStore(), receipt = {};
for (const [sourceUrl, asset] of assets) {
    const uploaded = asset.reuse ? { url: asset.reuse, existed: true }
        : await store.putObject(asset.key, fs.readFileSync(asset.file), asset.contentType);
    assert.ok(uploaded.url.startsWith('https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/'));
    const response = await fetch(uploaded.url); assert.equal(response.status, 200);
    assert.equal(hash(Buffer.from(await response.arrayBuffer())), asset.sha256);
    const metadata = await verifyPublicUrl(uploaded.url, { expectedBytes: asset.bytes, expectedContentType: asset.contentType });
    assert.deepEqual(metadata.problems.filter(problem => !problem.startsWith('content-length 0 !=')), []);
    receipt[sourceUrl] = { ...asset, ...uploaded, verified: true };
    fs.writeFileSync(dir + '/asset-receipt.json', JSON.stringify(receipt, null, 2) + '\n');
    console.log('VERIFIED ' + asset.sha256.slice(0, 12));
}
for (const kit of Object.values(rows)) for (const part of kit.parts) {
    const hosted = receipt[part.image.url];
    Object.assign(part.image, { url: hosted.url, key: hosted.key, sha256: hosted.sha256, bytes: hosted.bytes });
}
Object.assign(manifest.rows, rows);
assert.equal(Object.keys(manifest.rows).length, prior.count + 18);
manifest.version = hash(JSON.stringify(manifest.rows)).slice(0, 16);
fs.writeFileSync(file, JSON.stringify(manifest) + '\n');
fs.writeFileSync('src/lib/paper-doll/approved-kit-index.json', JSON.stringify({ version: manifest.version, skus: Object.keys(manifest.rows).sort() }) + '\n');
fs.writeFileSync(dir + '/release-manifest.json', JSON.stringify({ version: manifest.version, configurations: Object.keys(manifest.rows).length,
    addedSkus: Object.keys(rows).sort(), preservedRecipes: prior.count, sourcePixelsChanged: false, geometryChanged: false,
    productionDataMutated: false, merged: false, deployed: false }, null, 2) + '\n');
console.log('HOSTED RECIPE VERSION ' + manifest.version);
