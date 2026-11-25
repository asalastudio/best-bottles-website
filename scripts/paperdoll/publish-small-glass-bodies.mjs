import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Display copies for the small-glass bodies of 24 Nov 2026 (scripts/diva-vial/small-glass-bodies.py): lossless WebP
// at 128/256/640/1200 (pixel-checked), as publish-boston-roller-inserts.mjs makes them, registered in
// display-images.generated.json so cards and the PDP pick the size they draw. The masters are already immutable
// repository files under /images/approved-masters. Repository files only; no Blob or database writes.
// Dry run by default; --apply writes.
const manifest = JSON.parse(fs.readFileSync('src/lib/paper-doll/small-glass-bodies.generated.json', 'utf8'));
const displayFile = 'src/lib/products/display-images.generated.json';
const display = JSON.parse(fs.readFileSync(displayFile, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const widths = [128, 256, 640, 1200];
const apply = process.argv.includes('--apply');
const plan = [];
for (const [key, body] of Object.entries(manifest.bodies)) {
    if (!body.image) continue;
    const master = body.image.url;
    const bytes = fs.readFileSync(`public${master}`);
    assert.equal(hash(bytes), body.image.sha256, `${master} changed`);
    const name = master.split('/').pop().split('.')[0];
    const copies = {}, pixelWidths = {}, writes = [];
    for (const width of widths) {
        const pipeline = sharp(bytes).resize({ width, withoutEnlargement: true }).ensureAlpha();
        const reference = await pipeline.clone().raw().toBuffer({ resolveWithObject: true });
        const data = await pipeline.clone().webp({ lossless: true, effort: 6, alphaQuality: 100 }).toBuffer();
        const decoded = await sharp(data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        assert.equal(decoded.info.width, reference.info.width); assert.equal(decoded.info.height, reference.info.height);
        for (let i = 0; i < reference.data.length; i += 4) {
            assert.equal(decoded.data[i + 3], reference.data[i + 3], 'Alpha changed');
            if (reference.data[i + 3]) for (const c of [0, 1, 2]) assert.equal(decoded.data[i + c], reference.data[i + c], 'Colour changed');
        }
        const copy = `/images/approved-masters/${name}-${decoded.info.width}.${hash(data).slice(0, 12)}.webp`;
        copies[width] = copy; pixelWidths[width] = decoded.info.width;
        if (!writes.some(([path]) => path === `public${copy}`)) writes.push([`public${copy}`, data]);
    }
    plan.push({ key, master, copies, pixelWidths, writes });
}
console.log(JSON.stringify(plan.map(({ key, master, copies, writes }) => ({ key, master, copies,
    files: writes.map(([path, data]) => `${path} (${Math.round(data.length / 1e3)} kB)`) })), null, 1));
if (!apply) process.exit(0);
for (const { master, copies, pixelWidths, writes } of plan) {
    for (const [path, data] of writes) fs.writeFileSync(path, data);
    display.sources[master] = copies;
    display.pixelWidths[master] = pixelWidths;
}
fs.writeFileSync(displayFile, JSON.stringify(display) + '\n');
console.log('APPLIED', plan.length, 'bodies');
