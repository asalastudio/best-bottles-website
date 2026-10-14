import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BuilderImage from '../src/components/bottle-builder/BuilderImage';
import PdpStage from '../src/components/pdp/PdpStage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawableRegisterKits } from '../src/lib/register/load';
import { stageLayout } from '../src/lib/products/pdp-redesign/stage';
import { throughGlassAppearance } from '../src/lib/register/through-glass';
import { assembledKit } from '../src/lib/register/stage-kit';

const file = process.env.BB_MEDIA_REVIEW_SNAPSHOT;
afterEach(() => vi.unstubAllEnvs());
(file ? describe : describe.skip)('Empire seated tube occlusion', () => {
    it('keeps the complete vintage tube width from its Photoshop layer through the seated length', async () => {
        vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '');
        const s = JSON.parse(fs.readFileSync(file!, 'utf8'));
        const kits = drawableRegisterKits(s.register);
        for (const sku of ['GBEmp50AnSpTslBlk', 'GBEmp50AnSpBlk']) {
            const tube = kits[sku].parts.find(p=>p.slot==='diptube'&&p.views?.includes('capon'))!;
            const {data,info}=await sharp(path.join(process.cwd(),'public',tube.image.url)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
            // The rejected extraction retained a 4–9 px edge, losing the
            // original 40+ px tube width. Check the actual retained pixels.
            for(const fraction of [0.25,0.45,0.65]) {
                const row=Math.round(info.height*fraction); let width=0;
                for(let x=0;x<info.width;x++) if(data[(row*info.width+x)*4+3]>128) width++;
                expect(width).toBeGreaterThan(35);
            }
            const floor=Math.max(...tube.throughGlass!.clip.map(p=>p[1]));
            expect(tube.bounds.bottom).toBeCloseTo(floor,0);
        }
    });
    it('puts the seated tube within the inner cavity and preserves the exposed tube', () => {
        vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '');
        const snapshot = JSON.parse(fs.readFileSync(file!, 'utf8'));
        const kits = drawableRegisterKits(snapshot.register);
        const kit = kits.GBEmp100SpryMtGl;
        const body = kit.parts.find(p => p.slot === 'body')!;
        const seated = kit.parts.find(p => p.slot === 'diptube' && p.views?.includes('capon'))! as any;
        const exposed = kit.parts.find(p => p.slot === 'diptube' && p.views?.includes('exploded'))! as any;
        // The old cut has glass-base fragments: clipping only at the bottle's
        // outer baseline lets them paint over the solid glass foot.
        expect(seated.throughGlass).toBeDefined();
        expect(Math.max(...seated.throughGlass.clip.map((p: number[]) => p[1]))).toBeLessThan(body.bounds.bottom - 90);
        expect(seated.throughGlass.opacity).toBeLessThan(1);
        expect(exposed.throughGlass).toBeUndefined();
        const row = snapshot.matrix.rows.find((r: any) => r.websiteSku === kit.sku);
        const layout = stageLayout(kit, 'capon', row)!;
        expect((layout.parts.find(p => p.slot === 'diptube') as any).throughGlass?.blendMode).toBe('multiply');
        expect(stageLayout(kit, 'exploded', row)!.parts.every((p: any) => !p.throughGlass)).toBe(true);
    });
    it('keeps the photographed pipette tip inside the cavity without cutting it off', () => {
        vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '');
        const s = JSON.parse(fs.readFileSync(file!, 'utf8'));
        const kit = drawableRegisterKits(s.register).GBEmp50DrpSl;
        const p = kit.parts.find(p=>p.slot==='pipette')!;
        const floor = Math.max(...p.throughGlass!.clip.map(p=>p[1]));
        expect(p.bounds.bottom).toBeLessThanOrEqual(floor-2);
    });
    it('removes the old source photograph’s glass-base pixels from the new foot', async () => {
        vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '');
        const s = JSON.parse(fs.readFileSync(file!, 'utf8'));
        const kit = drawableRegisterKits(s.register).GBEmp100SpryMtGl;
        const body = kit.parts.find(p=>p.slot==='body')!;
        const tube = kit.parts.find(p=>p.slot==='diptube'&&p.views?.includes('capon'))!;
        async function image(p: typeof body, clipped: boolean) {
            const data=fs.readFileSync(path.join(process.cwd(),'public',p.image.url)).toString('base64');
            const g=clipped?throughGlassAppearance(p,'capon'):null;
            const scale=p.box.width/p.image.width;
            return `<g transform="translate(${p.box.x} ${p.box.y}) scale(${scale})" ${g?`opacity="${g.opacity}" style="mix-blend-mode:multiply"`:''}>${g?`<defs><clipPath id="glass"><polygon points="${g.clipPoints}"/></clipPath></defs>`:''}<image width="${p.image.width}" height="${p.image.height}" ${g?'clip-path="url(#glass)"':''} href="data:image/png;base64,${data}"/></g>`;
        }
        const b = await image(body,false);
        async function render(extra: string) { return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1100"><rect width="100%" height="100%" fill="#f5f3ef"/>${b}${extra}</svg>`)).removeAlpha().raw().toBuffer(); }
        const [bare,old,fixed] = await Promise.all([render(''),render(await image(tube,false)),render(await image(tube,true))]);
        const floor=Math.max(...tube.throughGlass!.clip.map(p=>p[1]));
        function difference(bytes: Buffer) {let sum=0,n=0;for(let y=Math.ceil(floor+8);y<1050;y++)for(let x=460;x<540;x++)for(let c=0;c<3;c++){const i=(y*1000+x)*3+c;sum+=Math.abs(bytes[i]-bare[i]);n++;}return sum/n;}
        expect(difference(old)).toBeGreaterThan(1);
        expect(difference(fixed)).toBeLessThan(0.1);
    });
    it('renders the treatment in both real display components', () => {
        vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '');
        const s = JSON.parse(fs.readFileSync(file!, 'utf8'));
        for(const sku of ['GBEmp100SpryMtGl', 'GBEmp50AnSpTslBlk']) {
        const kit = drawableRegisterKits(s.register)[sku];
        const row = s.matrix.rows.find((r: any) => r.websiteSku === kit.sku);
        const builder = renderToStaticMarkup(createElement(BuilderImage, { config: {
            id: kit.sku, family: 'Empire', capacityMl: 100, neck: '18-415', color: 'Clear', fitment: row.applicator, kit: assembledKit(kit),
        } as any, parts: assembledKit(kit).parts, label: 'Empire', stage: 'complete', showCover: true }));
        const pdp = renderToStaticMarkup(createElement(PdpStage, {
            kit, context: row, pickLine: '', view: 'capon', availableViews: ['capon'], onViewChange: () => {},
            fallbackImageUrls: [], fallbackBodyImageUrl: null, fallbackAlt: 'Empire', callouts: [], caps: [],
            activeCapId: null, onCapPick: () => {}, glasses: [], onGlassPick: () => {}, activeCapName: null, activeGlassLabel: 'Clear',
        }));
        for(const html of [builder,pdp]) {
            expect(html).toContain('mix-blend-mode:multiply');
            expect(html).toContain('opacity:0.68');
        }
        expect(builder).toContain('<polygon');
        expect(pdp).toContain('clip-path:polygon(');
        if(sku==='GBEmp50AnSpTslBlk') for(const html of [builder,pdp]) expect(html).toContain('filter:brightness(0.96)');
        }
    });
});
