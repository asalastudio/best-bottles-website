import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const dir = 'docs/reviews/sleek8-hero-depth-2026-11-01';
const file = 'src/lib/paper-doll/approved-kits.generated.json';
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
const before = read(dir + '/before-kits.json'), prior = read(dir + '/prior-recipe-hashes.json');
const manifest = read(file), skus = Object.keys(before.rows);
assert.equal(skus.length, 8); assert.equal(Object.keys(manifest.rows).length, 438);
assert.equal(Object.keys(prior.recipes).length, 430);
for (const [sku, hash] of Object.entries(prior.recipes)) assert.equal(digest(canonical(manifest.rows[sku])), hash, 'Unrelated recipe changed: ' + sku);
for (const sku of skus) {
    const kit = manifest.rows[sku], original = before.rows[sku];
    assert.equal(kit.register.bodyId, 'sleek-8ml-13-415');
    const restored = structuredClone(kit);
    restored.parts.forEach((part, i) => {
        if (part.slot === 'body') delete part.blendMode;
        if (part.slot === 'diptube' && part.views?.includes('sidecar')) {
            part.zOrder = original.parts[i].zOrder; part.opacity = original.parts[i].opacity; delete part.blendMode;
        }
    });
    assert.deepEqual(restored, original, 'Unexpected geometry or asset change: ' + sku);
    const body = kit.parts.find(p => p.slot === 'body');
    const tube = kit.parts.find(p => p.slot === 'diptube' && p.views?.includes('sidecar'));
    assert(body && tube); body.blendMode = 'multiply';
    Object.assign(tube, { zOrder: body.zOrder - 0.5, opacity: 0.4, blendMode: 'multiply' });
    assert(kit.parts.every(p => p.image.url.startsWith('https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/')));
}
const version = digest(manifest.rows).slice(0, 16);
console.log(JSON.stringify({ scope: skus, version, preservedRecipes: 430, newImages: 0, apply: process.argv.includes('--apply') }));
if (process.argv.includes('--apply')) {
    manifest.version = version;
    fs.writeFileSync(file, JSON.stringify(manifest) + '\n');
    fs.writeFileSync('src/lib/paper-doll/approved-kit-index.json', JSON.stringify({ version, skus: Object.keys(manifest.rows).sort() }) + '\n');
    fs.writeFileSync(dir + '/release-manifest.json', JSON.stringify({ version, priorVersion: before.version, scope: skus, configurations: 438, preservedRecipes: 430, newImages: 0, approvedBodyPixelsChanged: false, geometryChanged: false, productionDataMutated: false, deployed: false, change: 'Seat tube behind multiply-blended glass at 40% opacity, matching the local review. Natural exploded tube remains unchanged.' }, null, 2) + '\n');
}
