import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawableRegisterKits } from '../src/lib/register/load';
import { kitsFromRegister } from '../src/lib/register/stage-kit';
import { localEmpireWhitePumpPayload } from '../src/lib/register/local-empire-white-pump';
import { localTasselMedia } from '../src/lib/register/local-tassel-media';
import { localEmpireBareGlass, localEmpireBodyImage } from '../src/lib/register/local-empire-bare-glass';
import assets from '../src/lib/register/local-empire-bare-glass.json';
import reducer from '../src/lib/register/local-empire-reducer.json';
import pipettes from '../src/lib/register/local-empire-pipettes.json';
import vintageTube from '../src/lib/register/local-empire-vintage-tube.json';
import sprayTube from '../src/lib/register/local-empire-100ml-spray-tube.json';
import additionalTubes from '../src/lib/register/local-empire-additional-spray-tubes.json';
import whitePumpTube from '../src/lib/register/local-empire-100ml-white-pump-tube.json';
const sprayTubes = [sprayTube, ...additionalTubes];
import { previewParts, reviewedBodyImage, bareGlassPreview, type BuilderConfiguration, type CatalogRow } from '../src/lib/bottle-builder/model';

const snapshotFile = process.env.BB_MEDIA_REVIEW_SNAPSHOT;
afterEach(() => vi.unstubAllEnvs());
describe('Empire local master assets', () => {
    it('preserves the transparent exterior and interior; 50 ml RGB and the 100 ml neck remain unchanged', async () => {
        const sources = [
            '/local-media/empire-bare-glass/empire-50ml-empty.f500e3f2cf9e.png',
            '/local-media/empire-bare-glass/empire-100ml-empty.ed5a12c41022.png',
        ];
        for (const [index, asset] of assets.entries()) {
            const candidate = path.join(process.cwd(), 'public', asset.url);
            expect((await sharp(candidate).metadata()).hasAlpha).toBe(true);
            const original = await sharp(path.join(process.cwd(), 'public', sources[index])).removeAlpha().raw().toBuffer();
            if (index === 0) expect((await sharp(candidate).removeAlpha().raw().toBuffer()).equals(original)).toBe(true);
            else {
                const neck = { left: 0, top: 0, width: asset.width, height: 351 };
                const source = path.join(process.cwd(), 'public', asset.sourceRgbUrl);
                expect((await sharp(candidate).extract(neck).removeAlpha().raw().toBuffer())
                    .equals(await sharp(source).extract(neck).removeAlpha().raw().toBuffer())).toBe(true);
                const { data, info } = await sharp(candidate).raw().toBuffer({ resolveWithObject: true });
                let left = info.width, right = 0, top = info.height, bottom = 0;
                for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] >= 250) {
                    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
                }
                // Allow subpixel edge sampling, but reject the original 4.6% mismatch.
                expect(Math.abs(((bottom-top+1)/(right-left+1))/(107/46)-1)).toBeLessThan(.003);
            }
            const { data, info } = await sharp(candidate).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
            const alpha = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];
            // Exterior pixels that used to erase the blueprint grid.
            for (let y = 0; y < info.height; y += 19) {
                expect(alpha(10, y)).toBe(0);
                expect(alpha(info.width - 11, y)).toBe(0);
            }
            for (let x = 0; x < info.width; x += 19) expect(alpha(x, 20)).toBe(0);
            // This correction isolates the exterior; it must not key out the
            // bright interior of the glass or change the bottle registration.
            expect(alpha(Math.floor(info.width / 2), 900)).toBe(255);
            expect([info.width, info.height]).toEqual([asset.width, asset.height]);
        }
    });
    it('retains a continuous native tube from housing to tip without missing rows', async () => {
        for (const sprayTube of sprayTubes) {
        const { data, info } = await sharp(`public${sprayTube.url}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        for (let y = 3; y < info.height - 4; y++) {
            let visible = 0;
            for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 10) visible++;
            expect(visible, `${sprayTube.websiteSku} tube row ${y}`).toBeGreaterThan(2);
        }
        }
    });
    it('uses the same empty masters in kitless chooser and glass-swatch paths', () => {
        vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '');
        for (const capacityMl of [50, 100]) {
            const image = reviewedBodyImage({ family: 'Empire', capacityMl, color: 'Clear', neckThreadSize: '18-415' } as CatalogRow)!;
            expect(image.url).toBe(assets.find(a => a.expectedPlate.bodyId === `empire-${capacityMl}ml-18-415`)!.url);
            expect(bareGlassPreview({ bodyImage: image, kit: {} } as BuilderConfiguration).bodyImage).toEqual(image);
        }
        expect(localEmpireBodyImage('Diva', 50, 'Clear', '18-415')).toBeNull();
        vi.stubEnv('NODE_ENV', 'production');
        expect(localEmpireBodyImage('Empire', 50, 'Clear', '18-415')).toBeNull();
    });
    it('preserves the reviewed file bytes at their content-addressed URLs', () => {
        for (const asset of [...assets, reducer, ...pipettes, vintageTube, ...sprayTubes, whitePumpTube]) {
            const bytes = fs.readFileSync(path.join(process.cwd(), 'public', asset.url));
            expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
        }
    });
});
(snapshotFile ? describe : describe.skip)('Empire masters on the complete captured family', () => {
    const snapshot = () => JSON.parse(fs.readFileSync(snapshotFile!, 'utf8'));
    it('uses one master per size across all 91 registered assemblies and keeps unchanged hardware geometry', () => {
        const s = snapshot();
        vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '');
        const original = Object.fromEntries(Object.entries(kitsFromRegister(localEmpireWhitePumpPayload(s.register)))
            .map(([sku, kit]) => [sku, localTasselMedia(kit)]));
        const local = drawableRegisterKits(s.register);
        const rows = s.matrix.rows.filter((r: any) => local[r.websiteSku]);
        expect(rows).toHaveLength(91);
        for (const row of rows) {
            const kit = local[row.websiteSku];
            const asset = assets.find(a => a.plateKey === kit.register.plateKey)!;
            const body = kit.parts.find(p => p.slot === 'body')!;
            expect(body.image.url, row.websiteSku).toBe(asset.url);
            expect(body.bounds.bottom).toBe(kit.anchors.baselineY);
            if (original[row.websiteSku]) {
                const replacedVintage = kit.parts.some(p=>p.image.url===vintageTube.url);
                const hardware = (parts: typeof kit.parts) => parts.filter(p => !['body', 'reducer', 'pipette'].includes(p.slot)
                    && !(replacedVintage && p.slot==='diptube' && p.views?.includes('capon'))
                    && !([...sprayTubes, whitePumpTube].some(t => t.websiteSku === row.websiteSku) && p.slot === 'diptube'))
                    .map(({ zOrder, throughGlass, ...p }) => p);
                expect(hardware(kit.parts), row.websiteSku).toEqual(hardware(original[row.websiteSku].parts));
            }
            const config = { kit, fitment: row.applicator } as BuilderConfiguration;
            expect(previewParts(config, 'body').map(p => p.slot)).toEqual(['body']);
            expect(kit.parts.some(p => p.slot === 'reducer')).toBe(row.applicator === 'Reducer');
            if(row.applicator === 'Dropper') {
                const pipette = kit.parts.find(p => p.slot === 'pipette')!;
                expect(pipette.zOrder).toBeGreaterThan(body.zOrder);
                expect(pipette.image.url).toBe(pipettes.find(p => p.websiteSku === row.websiteSku)!.url);
                expect(pipette.bounds.bottom).toBeLessThan(body.bounds.bottom);
            }
        }
        expect(local.LBEmp100WhtClOvrCp.parts.find(p => p.slot === 'pump')?.componentId).toBe(whitePumpTube.componentId);
        expect(s.register.plates[assets[0].plateKey].url).toBe(assets[0].expectedPlate.url);
    });
    it('uses the continuous native spray tube in both views, joined to its exact sprayer', () => {
        vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '');
        for (const sprayTube of sprayTubes) {
        const kit = drawableRegisterKits(snapshot().register)[sprayTube.websiteSku];
        const sprayer = kit.parts.find(p => p.slot === 'sprayer')!;
        const tubes = kit.parts.filter(p => p.slot === 'diptube');
        expect(tubes).toHaveLength(2);
        expect(tubes[0].image.url).toBe(sprayTube.url);
        expect(tubes[1].image.url).toBe(sprayTube.url);
        expect(tubes[0].box).toEqual(tubes[1].box);
        expect(tubes[0].bounds.top).toBeCloseTo(sprayer.box.y + sprayer.box.height * sprayTube.visibleBottomFraction - 2, 2);
        expect(tubes[0].bounds.bottom).toBeLessThan(kit.anchors.baselineY);
        const other = drawableRegisterKits(snapshot().register)[sprayTube.websiteSku.endsWith('MtGl') ? sprayTube.websiteSku.replace('MtGl', 'MtSl') : sprayTube.websiteSku.replace(/Spry.*/, 'SpryMtGl')];
        expect(other.parts.filter(p => p.slot === 'diptube').every(p => p.image.url !== sprayTube.url)).toBe(true);
        }
    });
    it('rejects changed plate geometry and stays inactive on production/Vercel', () => {
        const s = snapshot();
        vi.stubEnv('NODE_ENV', 'production');
        const kits = drawableRegisterKits(s.register);
        const kit = kits.GBEmp50RdcrBlkLthr;
        const plate = s.register.plates[kit.register.plateKey];
        expect(localEmpireBareGlass(kit, plate)).toBe(kit);
        vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '1');
        expect(localEmpireBareGlass(kit, plate)).toBe(kit);
        vi.stubEnv('VERCEL', '');
        for (const changed of [{ ...plate, url: plate.url + '?changed' }, { ...plate, anchors: { ...plate.anchors, shoulderY: plate.anchors.shoulderY + 1 } }]) {
            expect(localEmpireBareGlass(kit, changed)).toBe(kit);
        }
    });
});
