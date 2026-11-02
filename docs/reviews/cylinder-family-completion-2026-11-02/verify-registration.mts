import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { availableViews, stageLayout } from '../../../src/lib/products/pdp-redesign/stage';
import type { ReviewKit, FamilySnapshot } from './review-types';
const dir = 'docs/reviews/cylinder-family-completion-2026-11-02';
const read = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const kits = read('public/local-kits/cylinder-family-completion-2026-11-02/kits.json').rows as Record<string, ReviewKit>;
const snapshot = read(dir + '/current-family-snapshot.json') as FamilySnapshot;
const catalog = Object.values(snapshot.families).flatMap(family => family.rows);
const registration = read(dir + '/registration.json');
const rollers = read(dir + '/roller-registration.json');
const bodies = new Map<string, string>(), hashes = new Map<string, string>();
const checks: object[] = [];
for (const [sku, kit] of Object.entries(kits)) {
    assert.equal(sku, kit.sku);
    const row = catalog.find(r => r.websiteSku === sku); assert(row, 'Not in catalog ' + sku);
    const body = kit.parts.find(p => p.slot === 'body')!; assert(body);
    const key = kit.register!.bodyId + '|' + kit.register!.glass;
    const signature = JSON.stringify({ image: body.image, box: body.box, bounds: body.bounds, anchors: kit.anchors, sizing: kit.glassSizing });
    if (bodies.has(key)) assert.equal(signature, bodies.get(key), 'Body changed across ' + sku);
    bodies.set(key, signature);
    for (const part of kit.parts) {
        const image = part.image;
        if (image.url.startsWith('/local-kits/') && !hashes.has(image.url)) {
            const bytes = fs.readFileSync('public' + image.url), sha = createHash('sha256').update(bytes).digest('hex');
            assert.equal(sha, image.sha256); hashes.set(image.url, sha);
        }
    }
    const context = { websiteSku: sku, family: row.family, capacityMl: row.capacityMl, color: row.color, applicator: row.applicator };
    const views = availableViews(kit, context);
    if (row.applicator?.includes('Bulb')) assert.deepEqual(views, ['capon']);
    let bodySignature: string | undefined;
    for (const view of views) {
        const layout = stageLayout(kit, view, context)!;
        const paintedBody = layout.parts.find(p => p.slot === 'body')!;
        const current = JSON.stringify({ frame: layout.frame, box: paintedBody.box, dx: paintedBody.dxPct, dy: paintedBody.dyPct });
        if (bodySignature) assert.equal(current, bodySignature, 'Body moved between views ' + sku);
        bodySignature = current;
        if (view === 'exploded') {
            const tube = layout.parts.find(p => p.slot === 'diptube');
            const native = kit.parts.find(p => p.slot === 'diptube' && p.views?.includes('exploded'));
            if (tube && native) {
                const head = kit.parts.find(p => p.componentId === native.componentId && p.slot !== 'diptube');
                const painted = head && layout.parts.find(p => p.slot === head.slot);
                assert(painted, 'Detached tube missing head ' + sku);
                assert.equal(tube.dxPct, painted.dxPct, 'Tube and head separate horizontally ' + sku);
                assert.equal(tube.dyPct, painted.dyPct, 'Tube and head separate vertically ' + sku);
            }
        }
    }
    const change = registration.changes.find((c: {sku:string;innerFloorY?:number;tipY?:number}) => c.sku === sku);
    if (change?.innerFloorY !== undefined && change?.tipY !== undefined) {
        assert(change.tipY < change.innerFloorY, 'Tube penetrates floor ' + sku);
        assert(change.innerFloorY < body.bounds.bottom, 'Floor is not inside body ' + sku);
    }
    checks.push({ sku, bodyKey: key, bodySha256: body.image.sha256, views });
}
assert.equal(checks.length, 109); assert.equal(bodies.size, 5);
for (const c of rollers.configurations) {
    assert.equal(c.protrudingPlug, false); assert.equal(c.overRim, true);
    assert(Math.abs(c.capBottomY - c.shoulderY) < .001);
    const kit = kits[c.sku];
    assert(c.flangeBottomY - c.rimY <= kit.anchors.pxPerMm! * .251);
}
const result = { passed: true, configurations: checks.length, distinctBodyMasters: bodies.size, sourceHashesVerified: hashes.size,
    noPlugRollerConfigurations: rollers.configurations.length, originalSourcesPreserved: true, checks,
    limits: ['Local candidate verification only. New bytes have no inherited appearance approval.', '16 mm hardware registration proportions are estimates from original artwork, not new caliper measurements.'] };
fs.writeFileSync(dir + '/registration-verification.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, configurations: checks.length, bodyMasters: bodies.size, sources: hashes.size }));
