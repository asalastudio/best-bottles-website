import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Serves the real PSD dip tubes and pipettes made by seated-dip-tubes.py (24 Nov 2026 parts audit) the way
// publish-boston-roller-inserts.mjs served the Boston rollers: an immutable copy under /images/approved-masters plus
// lossless WebP display copies (128/256/640/1200, pixel-checked), and writes the placements the kits read
// (src/lib/paper-doll/seated-dip-tubes.generated.json). Repository files only; no Blob or database writes.
// With --register (a plan from seated-dip-tubes.py --register) it writes the register tubes heroTube() draws instead,
// keyed by plate and fitment family (src/lib/register/psd-tubes.generated.json); each set replaces only its own files.
//   node scripts/paperdoll/publish-seated-dip-tubes.mjs <work-dir> [--register] [--apply]
const work = process.argv[2];
if (!work) throw new Error('usage: publish-seated-dip-tubes.mjs <work-dir> [--apply]');
const apply = process.argv.includes('--apply');
const plan = JSON.parse(fs.readFileSync(path.join(work, 'plan.json'), 'utf8'));
const displayFile = 'src/lib/products/display-images.generated.json';
const register = process.argv.includes('--register');
const outFile = register ? 'src/lib/register/psd-tubes.generated.json' : 'src/lib/paper-doll/seated-dip-tubes.generated.json';
// Approved-kit tubes are dip-tube-<body>..., register tubes dip-tube-register-<body>...: a rebuild of one keeps the other.
const ownFile = file => file.startsWith('dip-tube-') && file.startsWith('dip-tube-register-') === register;
const display = JSON.parse(fs.readFileSync(displayFile, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const widths = [128, 256, 640, 1200];

const images = {}, writes = [], copiesFor = {};
for (const [name, file] of Object.entries(plan.images)) {
    const bytes = fs.readFileSync(path.join(work, file));
    const sha256 = hash(bytes);
    const master = `/images/approved-masters/dip-tube-${name}.${sha256.slice(0, 12)}.png`;
    const meta = await sharp(bytes).metadata();
    images[name] = { url: master, key: master, sha256, bytes: bytes.length, width: meta.width, height: meta.height };
    writes.push([`public${master}`, bytes]);
    const copies = {}, pixelWidths = {};
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
        const copy = `/images/approved-masters/dip-tube-${name}-${decoded.info.width}.${hash(data).slice(0, 12)}.webp`;
        copies[width] = copy; pixelWidths[width] = decoded.info.width;
        if (!writes.some(([p]) => p === `public${copy}`)) writes.push([`public${copy}`, data]);
    }
    copiesFor[master] = { copies, pixelWidths };
}

const groups = Object.fromEntries(Object.entries(plan.groups).map(([name, group]) => [name, {
    bodyId: group.bodyId, glass: group.glass, kind: group.kind,
    seated: images[group.seated], exploded: images[group.exploded],
    box: group.box, floorY: group.floorY, opaque: group.opaque, opacity: group.opacity, sourcePxPerMm: group.sourcePxPerMm,
    ...(register ? { plateKey: group.plateKey, families: group.families, datum: group.datum, glassBounds: group.glassBounds, innerFloorY: group.innerFloorY, stemExits: group.stemExits } : {}),
}]));
// The register set is looked up by `${plateKey}|${family}` (bulb and tassel share the bulb tube).
const body = register
    ? { tubes: Object.fromEntries(Object.values(groups).flatMap(group => group.families.map(family => [`${group.plateKey}|${family}`, group]))) }
    : { groups, skus: plan.skus };
const generated = { version: hash(Buffer.from(JSON.stringify(body))).slice(0, 16), source: 'scripts/paperdoll/seated-dip-tubes.py', ...body };
console.log(JSON.stringify({ version: generated.version, groups: Object.keys(groups).length, skus: Object.keys(plan.skus).length, keys: Object.keys(body.tubes ?? body.groups).length,
    files: writes.length, kB: Math.round(writes.reduce((n, [, d]) => n + d.length, 0) / 1e3) }));
if (!apply) process.exit(0);
// A rebuild replaces the whole set: earlier copies and their display entries are dropped first.
for (const file of fs.readdirSync('public/images/approved-masters')) if (ownFile(file)) fs.rmSync(`public/images/approved-masters/${file}`);
for (const key of Object.keys(display.sources)) if (ownFile(key.replace('/images/approved-masters/', ''))) delete display.sources[key];
for (const key of Object.keys(display.pixelWidths)) if (ownFile(key.replace('/images/approved-masters/', ''))) delete display.pixelWidths[key];
for (const [p, data] of writes) fs.writeFileSync(p, data);
for (const [master, { copies, pixelWidths }] of Object.entries(copiesFor)) {
    display.sources[master] = copies;
    display.pixelWidths[master] = pixelWidths;
}
fs.writeFileSync(displayFile, JSON.stringify(display) + '\n');
fs.writeFileSync(outFile, JSON.stringify(generated, null, 1) + '\n');
console.log('APPLIED', Object.keys(images).length, 'images');
