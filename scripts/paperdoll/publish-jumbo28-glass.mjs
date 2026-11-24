import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// The 28 ml Cylinder 16 mm roll-ons go live with the reviewed Sunburst glass (jumbo-glass-2026-11-04): the clear body,
// and the frosted body the Frosted group wears over its clear twin's roller and cap. Both bodies sit in the review folder
// /reviews/cylinder28-sunburst-2026-11-04, which only localhost reads. This serves them the way #428 served the Boston
// roller inserts: an immutable copy under /images/approved-masters plus lossless WebP display copies
// (128/256/640/1200, pixel-checked), and an alias from the review path in display-images.generated.json.
// The rollers and caps in those kits are already hosted (reviewed-master-media/2026-11-02 on Blob, aliased).
// Repository files only; no Blob or database writes. Dry run by default; --apply writes.
const sources = {
    'cylinder28-glass-clear': 'public/reviews/cylinder28-sunburst-2026-11-04/clear-candidate.png',
    'cylinder28-glass-frosted': 'public/reviews/cylinder28-sunburst-2026-11-04/frosted-candidate.png',
};
const displayFile = 'src/lib/products/display-images.generated.json';
const display = JSON.parse(fs.readFileSync(displayFile, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const widths = [128, 256, 640, 1200];
const apply = process.argv.includes('--apply');
const plan = [];
for (const [name, file] of Object.entries(sources)) {
    const bytes = fs.readFileSync(file);
    const master = `/images/approved-masters/${name}.${hash(bytes).slice(0, 12)}.png`;
    const alias = file.replace(/^public/, '');
    const copies = {}, pixelWidths = {}, writes = [[`public${master}`, bytes]];
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
    plan.push({ alias, master, copies, pixelWidths, writes });
}
console.log(JSON.stringify(plan.map(({ alias, master, copies, pixelWidths, writes }) => ({ alias, master, copies, pixelWidths,
    files: writes.map(([path, data]) => `${path} (${Math.round(data.length / 1e3)} kB)`) })), null, 1));
if (!apply) process.exit(0);
for (const { alias, master, copies, pixelWidths, writes } of plan) {
    for (const [path, data] of writes) fs.writeFileSync(path, data);
    display.aliases[alias] = master;
    display.sources[master] = copies;
    display.pixelWidths[master] = pixelWidths;
}
fs.writeFileSync(displayFile, JSON.stringify(display) + '\n');
console.log('APPLIED', plan.length, 'glass bodies');
