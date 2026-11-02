import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const dir = 'docs/reviews/tall9-pour-cap-fit-2026-11-01';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const before = read(dir + '/before-kits.json');
const file = 'src/lib/paper-doll/approved-kits.generated.json';
const manifest = read(file);
const files = fs.readdirSync('public/local-kits', { recursive: true }).filter(file => typeof file === 'string');
const rows = structuredClone(before.rows), corrections = [];
assert.equal(Object.keys(rows).length, 20);
for (const [sku, kit] of Object.entries(rows)) {
    const cap = kit.parts.find(part => part.slot === 'cap');
    assert.equal(kit.register.bodyId, 'cylinder-9ml-13-415');
    assert.ok(!kit.parts.some(part => ['roller', 'sprayer'].includes(part.slot)));
    const source = files.find(file => file.includes(cap.image.sha256.slice(0, 12)));
    assert.ok(source, 'Missing original cap ' + sku);
    const bytes = fs.readFileSync('public/local-kits/' + source);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), cap.image.sha256);
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = info.width, right = 0, bottom = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * 4 + 3] < 128) continue;
        left = Math.min(left, x); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
    }
    assert.ok(right > left && bottom > 0);
    const visibleCenter = cap.box.x + (left + right) / 2 / info.width * cap.box.width;
    const visibleBottom = cap.box.y + bottom / info.height * cap.box.height;
    const targetAxis = kit.anchors.neckAxisX ?? kit.anchors.axisX;
    const dx = targetAxis - visibleCenter, dy = cap.bounds.bottom - visibleBottom;
    // Translate only. Cap widths, heights and pixels remain the physical source proportions.
    cap.box.x += dx; cap.box.y += dy;
    cap.bounds.left += dx; cap.bounds.right += dx;
    // Keep the historical contact line: ribbed caps meet the final thread;
    // lined caps meet the reviewed shoulder. Only transparent source padding moves.
    corrections.push({ sku, componentId: cap.componentId, imageSha256: cap.image.sha256,
        alphaThreshold: 128, visiblePixels: { left, right, bottom, width: info.width, height: info.height },
        previousVisibleCenter: visibleCenter, previousVisibleBottom: visibleBottom,
        targetAxis, targetBottom: cap.bounds.bottom, dx, dy,
        capWidth: cap.box.width, capHeight: cap.box.height, sourceFile: 'public/local-kits/' + source });
}
Object.assign(manifest.rows, rows);
manifest.version = createHash('sha256').update(JSON.stringify(manifest.rows)).digest('hex').slice(0, 16);
assert.equal(Object.keys(manifest.rows).length, 456);
fs.writeFileSync(file, JSON.stringify(manifest) + '\n');
fs.writeFileSync('src/lib/paper-doll/approved-kit-index.json', JSON.stringify({ version: manifest.version, skus: Object.keys(manifest.rows).sort() }) + '\n');
fs.writeFileSync(dir + '/cap-registration.json', JSON.stringify({ version: manifest.version, scope: Object.keys(rows).sort(),
    corrections, sourcePixelsChanged: false, capResized: false, bodiesChanged: false, productionDataMutated: false }, null, 2) + '\n');
console.log(JSON.stringify({ version: manifest.version, corrected: corrections.length,
    maxHorizontalCorrection: Math.max(...corrections.map(row => Math.abs(row.dx))),
    maxVerticalCorrection: Math.max(...corrections.map(row => Math.abs(row.dy))) }));
