import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
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
import { previewParts, reviewedBodyImage, bareGlassPreview, type BuilderConfiguration, type CatalogRow } from '../src/lib/bottle-builder/model';

const snapshotFile = process.env.BB_MEDIA_REVIEW_SNAPSHOT;
afterEach(() => vi.unstubAllEnvs());
describe('Empire local master assets', () => {
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
        for (const asset of [...assets, reducer, ...pipettes, vintageTube]) {
            const bytes = fs.readFileSync(path.join(process.cwd(), 'public', asset.url));
            expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
        }
    });
});
(snapshotFile ? describe : describe.skip)('Empire masters on the complete captured family', () => {
    const snapshot = () => JSON.parse(fs.readFileSync(snapshotFile!, 'utf8'));
    it('uses one master per size across 90 registered assemblies and keeps unchanged hardware geometry', () => {
        const s = snapshot();
        vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '');
        const original = Object.fromEntries(Object.entries(kitsFromRegister(localEmpireWhitePumpPayload(s.register)))
            .map(([sku, kit]) => [sku, localTasselMedia(kit)]));
        const local = drawableRegisterKits(s.register);
        const rows = s.matrix.rows.filter((r: any) => local[r.websiteSku]);
        expect(rows).toHaveLength(90);
        for (const row of rows) {
            const kit = local[row.websiteSku];
            const asset = assets.find(a => a.plateKey === kit.register.plateKey)!;
            const body = kit.parts.find(p => p.slot === 'body')!;
            expect(body.image.url, row.websiteSku).toBe(asset.url);
            expect(body.bounds.bottom).toBe(kit.anchors.baselineY);
            if (original[row.websiteSku]) {
                const replacedVintage = kit.parts.some(p=>p.image.url===vintageTube.url);
                const hardware = (parts: typeof kit.parts) => parts.filter(p => !['body', 'reducer', 'pipette'].includes(p.slot)
                    && !(replacedVintage && p.slot==='diptube' && p.views?.includes('capon')))
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
        expect(local.LBEmp100WhtClOvrCp).toBeUndefined(); // unresolved exact white-pump source stays held
        expect(s.register.plates[assets[0].plateKey].url).toBe(assets[0].expectedPlate.url);
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
