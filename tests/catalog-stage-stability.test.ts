import { describe, expect, it } from 'vitest';
import { pdpReviewedGlassFrame, pdpReviewedGlassViewport } from '@/lib/products/pdp-stage-frame';
import { registeredGlassSizing } from '@/lib/register/catalog-scale';
import { stageLayout, type KitLike } from '@/lib/products/pdp-redesign/stage';
import { builderBodyFrame, builderPreviewLayout } from '@/lib/bottle-builder/preview-layout';
import { previewParts, type BuilderConfiguration } from '@/lib/bottle-builder/model';
import { bareChooserKit } from '@/lib/bottle-builder/payload';

const plate = { width: 1000, height: 1100, pxPerMm: 10, url: '/glass.png', anchors: { axisX: 500, seatY: 200, shoulderY: 300, baselineY: 1000 } };
const body = { slot: 'body', zOrder: 0, explodeIndex: 0, bounds: { left: 400, right: 600, top: 200, bottom: 1000 }, box: { x: 0, y: 0, width: 1000, height: 1100 }, assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: 0 }, image: { url: '/glass.png', width: 1000, height: 1100 } };
function kit(tall = false): KitLike {
    return { sku: tall ? 'spray' : 'cap', canvas: { width: 1000, height: 1100 }, anchors: { axisX: 500, neckAxisX: 500, seatY: 200, baselineY: 1000 },
        register: { bodyId: 'cylinder-9ml-17-415', plateKey: 'cylinder-9ml-17-415|Clear', glass: 'Clear' },
        glassSizing: registeredGlassSizing('cylinder-9ml-17-415', plate, body),
        parts: [body, { ...body, slot: tall ? 'overcap' : 'cap', zOrder: 1, explodeIndex: 1,
            bounds: { left: 385, right: 615, top: tall ? -100 : 70, bottom: 250 },
            image: { url: tall ? '/tall.png' : '/short.png', width: 1000, height: 1100 } }] };
}

describe('the shared catalog stage', () => {
    it('uses the approved 9 ml shoulder span, not the rim or cap height, in every PDP view', () => {
        const frames = [];
        for (const tall of [false, true]) for (const view of ['sidecar','capon','exploded'] as const) {
            const k = kit(tall), l = stageLayout(k, view, { family: 'Cylinder', capacityMl: 9 })!;
            expect((1000 - 300) * l.frame.scale / 1100 * 100).toBeCloseTo(43.5, 8);
            expect(l.frame.y + 1000 * l.frame.scale / 1100 * 100).toBeCloseTo(91, 8);
            expect(l.frame.x + 500 * l.frame.scale / 1000 * 100).toBeCloseTo(50, 8);
            frames.push(l.frame);
        }
        for (const f of frames) expect(f).toEqual(frames[0]);
    });

    it('uses exactly the same viewport for builder body, fitment, complete and expanded views', () => {
        for (const tall of [false, true]) {
            const k = kit(tall);
            const c = { id: k.sku, bodyId: k.register!.bodyId, family: 'Cylinder', capacityMl: 9, color: 'Clear', neck: '17-415', fitment: 'Fine Mist Sprayer', kit: k } as unknown as BuilderConfiguration;
            const target = pdpReviewedGlassViewport(body.bounds, 500, k.glassSizing!, 1000, 1100)!;
            for (const stage of ['body','fitment','complete'] as const) for (const showCover of [false,true]) for (const expanded of [false,true]) {
                const layout = builderPreviewLayout(c, previewParts(c, stage), { stage, showCover })!;
                expect(builderBodyFrame(c, [c], undefined, layout, { expanded })).toEqual(target);
                expect(layout.layers.find(l => l.part.slot === 'body')!.part.image.url).toBe('/glass.png');
            }
            const firstPaint = bareChooserKit(c.kit!);
            expect(firstPaint?.glassSizing).toEqual(k.glassSizing);
            expect(firstPaint?.register?.bodyId).toBe(k.register!.bodyId);
        }
    });

    it('makes the SVG viewBox and CSS frame exact inverses at different canvas resolutions', () => {
        for (const resolution of [1, 2]) {
            const b = Object.fromEntries(Object.entries(body.bounds).map(([key,value]) => [key,value*resolution])) as typeof body.bounds;
            const sizing = { heightPct: 43.5, baselinePct: 91, landmarkY: 300*resolution };
            const f = pdpReviewedGlassFrame(b,500*resolution,sizing,1000*resolution,1100*resolution)!;
            const v = pdpReviewedGlassViewport(b,500*resolution,sizing,1000*resolution,1100*resolution)!;
            expect((b.bottom-v.y)/v.height*100).toBeCloseTo(f.y+b.bottom*f.scale/(1100*resolution)*100,10);
            expect((500*resolution-v.x)/v.width*100).toBeCloseTo(50,10);
        }
    });

    it('preserves the full-glass vial exception and refuses incomplete landmarks or uncleared bodies', () => {
        expect(registeredGlassSizing('cylinder-9ml-17-415', { ...plate, anchors: { ...plate.anchors, shoulderY: null } }, body)).toBeUndefined();
        expect(registeredGlassSizing('round-78ml-18-415', plate, body)).toBeUndefined();
        const f = pdpReviewedGlassFrame(body.bounds,500,{heightPct:40.24,baselinePct:91},1000,1100)!;
        expect((body.bounds.bottom-body.bounds.top)*f.scale/1100*100).toBeCloseTo(40.24,10);
    });
});
