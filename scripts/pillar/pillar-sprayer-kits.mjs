import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Jordan (4 Nov 2026): "fix this and make complete". The Pillar 9 ml spray bottle sells in 7 sprayer finishes on
// the old site (bestbottles.com/product/pillar-design-5-ml-glass-bottle-<finish>-spray, all 13-415, 78 mm with cap,
// 21 mm wide); the catalogue has only GBPillar9SpryBlkMatt, whose localhost kit used an unapproved AI-recovered body.
// This builds one review kit per finish on localhost (public/local-kits/pillar-masters-2026-11-04/kits.json):
// - the body is the photographed Pillar glass (scripts/pillar/pillar-body.py), set on the matte-black kit's own
//   footprint: neck top on seatY, base on baselineY, centred on the axis;
// - each finish's sprayer and overcap are the 13-415 layers the Cylinder 5 ml kits use (same fitment), moved by the
//   exact offset that seats the matte-black sprayer on the Pillar today;
// - the dip tube is the matte-black kit's own, its foot raised to the floor of the heavy glass base.
// Nothing is written outside this folder. Usage: node scripts/pillar/pillar-sprayer-kits.mjs
const OUT = 'public/local-kits/pillar-masters-2026-11-04';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const round = value => Math.round(value * 1000) / 1000;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

const pillar = read('public/local-kits/remaining-13-415-2026-11-01/kits.json').rows.GBPillar9SpryBlkMatt;
const cyl5 = read('public/local-kits/cylinder5-finemist-2026-11-01/kits.json').rows;
assert(pillar && pillar.register.bodyId === 'pillar-9ml-13-415');
const FINISHES = { BlkMatt: 'BlkMatt', BlkShn: 'BlkSh', BluMatt: 'BluMatt', GlMatt: 'GlMatt', GlShn: 'GlSh', SlMatt: 'SlMatt', SlShn: 'SlSh' };

// 1. The photographed body on the existing footprint.
const bodyFile = fs.readdirSync(OUT).filter(f => /^body-pillar-9ml-13-415-clear\.[0-9a-f]{12}\.png$/.test(f));
assert.equal(bodyFile.length, 1, 'Run scripts/pillar/pillar-body.py first (exactly one body file)');
const bodyPath = `${OUT}/${bodyFile[0]}`, bodyBytes = fs.readFileSync(bodyPath);
const { data, info } = await sharp(bodyBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const rowSpan = y => { let lo = -1, hi = -1; for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 40) { if (lo < 0) lo = x; hi = x; } return [lo, hi]; };
let top = 0; while (rowSpan(top)[0] < 0) top++;
let bottom = info.height - 1; while (rowSpan(bottom)[0] < 0) bottom--;
const widths = Array.from({ length: info.height }, (_, y) => { const [lo, hi] = rowSpan(y); return lo < 0 ? 0 : hi - lo + 1; });
const full = Math.max(...widths), shoulderRow = widths.findIndex(w => w > 0.9 * full);
const [left, right] = rowSpan(Math.round((shoulderRow + bottom) / 2));
// The base: the first row (well below the shoulder) where the middle of the bottle turns solid again.
const mid = Math.round((left + right) / 2);
let baseRow = shoulderRow + 100; while (data[(baseRow * info.width + mid) * 4 + 3] <= 200) baseRow++;
const { seatY, baselineY, axisX, pxPerMm } = pillar.anchors;
const scale = (baselineY - seatY) / (bottom + 1 - top);
const bodyBox = { x: round(axisX - (left + right + 1) / 2 * scale), y: round(seatY - top * scale), width: round(info.width * scale), height: round(info.height * scale) };
const bodyImage = { url: '/' + bodyPath.replace(/^public\//, ''), key: '', sha256: sha(bodyBytes), bytes: bodyBytes.length, width: info.width, height: info.height };
const toY = row => bodyBox.y + row * scale;
const bodyBounds = { left: round(bodyBox.x + left * scale), right: round(bodyBox.x + (right + 1) * scale), top: seatY, bottom: baselineY };
const measured = { scale: round(scale), diameterMm: round((right + 1 - left) * scale / pxPerMm), shoulderY: round(toY(shoulderRow)), baseFloorY: round(toY(baseRow)) };

// 2. Sprayer and overcap: the offset that seats the matte-black layers on the Pillar today, applied to every finish.
const slotOf = (kit, slot) => kit.parts.find(part => part.slot === slot);
const shift = {};
for (const slot of ['sprayer', 'overcap']) {
    const from = slotOf(cyl5.GBCyl5SpryBlkMatt, slot).box, to = slotOf(pillar, slot).box;
    assert.equal(slotOf(cyl5.GBCyl5SpryBlkMatt, slot).image.url, slotOf(pillar, slot).image.url, 'Pillar matte black uses the Cylinder 5 layer');
    const s = to.width / from.width; shift[slot] = { s, dx: to.x - from.x * s, dy: to.y - from.y * s };
}
const moved = (box, { s, dx, dy }) => ({ x: round(box.x * s + dx), y: round(box.y * s + dy), width: round(box.width * s), height: round(box.height * s) });
const boundsOf = (box, bounds, srcBox, t) => bounds ? ({ left: round(bounds.left * t.s + t.dx), right: round(bounds.right * t.s + t.dx),
    top: round(bounds.top * t.s + t.dy), bottom: round(bounds.bottom * t.s + t.dy) }) : { left: box.x, top: box.y, right: round(box.x + box.width), bottom: round(box.y + box.height) };

// 3. The dip tube: same image, its foot on the floor of the base (0.5 mm above it), aspect kept, centred on the axis.
const tubeFoot = measured.baseFloorY - 0.5 * pxPerMm;
const tubeFor = part => {
    const ratio = part.box.width / part.box.height, height = tubeFoot - part.box.y, width = height * ratio;
    const box = { x: round(axisX - width / 2), y: round(part.box.y), width: round(width), height: round(height) };
    return { ...part, box, bounds: { left: box.x, top: box.y, right: round(box.x + box.width), bottom: round(box.y + box.height) } };
};

const rows = {};
for (const [finish, cylFinish] of Object.entries(FINISHES)) {
    const sku = `GBPillar9Spry${finish}`, source = cyl5[`GBCyl5Spry${cylFinish}`];
    assert(source, 'Missing Cylinder 5 layer set for ' + finish);
    const componentId = slotOf(source, 'sprayer').componentId;
    const parts = pillar.parts.map(part => {
        if (part.slot === 'body') return { ...part, image: bodyImage, box: bodyBox, bounds: bodyBounds, derivation: 'psd-layer:27. GBPillar9RollBlk.psd/Layer 8 (card removed)' };
        if (part.slot === 'diptube') return { ...tubeFor(part), componentId };
        if (part.slot === 'sprayer' || part.slot === 'overcap') {
            const src = slotOf(source, part.slot), box = moved(src.box, shift[part.slot]);
            return { ...part, image: src.image, box, bounds: boundsOf(box, src.bounds, src.box, shift[part.slot]), componentId: src.componentId };
        }
        return part;
    });
    rows[sku] = { ...pillar, sku, parts, reviewMaster: 'pillar-masters-2026-11-04',
        register: { ...pillar.register, componentIds: [componentId] } };
}
const version = sha(JSON.stringify(rows)).slice(0, 12);
fs.writeFileSync(`${OUT}/kits.json`, JSON.stringify({ version, rows, defaultPdpSkus: ['GBPillar9SpryBlkMatt'], measured }, null, 1) + '\n');
console.log(JSON.stringify({ version, skus: Object.keys(rows), body: bodyImage.url, bodyBox, measured }, null, 1));
