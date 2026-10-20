import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import BuilderImage from '../src/components/bottle-builder/BuilderImage';
import PdpStage from '../src/components/pdp/PdpStage';
import { drawableRegisterKits } from '../src/lib/register/load';
import { assembledKit, type RegisterStagePayload } from '../src/lib/register/stage-kit';
import { registerVintagePreview } from '../src/lib/bottle-builder/preview-registration';
import { stageLayout } from '../src/lib/products/pdp-redesign/stage';
import type { BuilderConfiguration } from '../src/lib/bottle-builder/model';
import manifest from '../src/lib/media-release/manifest.json';
import makeConfig from '../next.config';
import { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from 'next/constants';
afterEach(() => vi.unstubAllEnvs());

describe('approved media through the real renderers', () => {
    it('keeps measured glass and continuous seated tubes in both stages for all 26 SKUs', () => {
        vi.stubEnv('NEXT_PUBLIC_BB_MEDIA_RELEASE', `${manifest.revision}:all`);
        const kits = Object.assign({}, ...['empire', 'round'].map(name => drawableRegisterKits(JSON.parse(fs.readFileSync(`tests/fixtures/media-release/${name}.json`, 'utf8')) as RegisterStagePayload)));
        for (const entry of manifest.entries) {
            const kit = kits[entry.websiteSku];
            const assembled = assembledKit(kit)!;
            const context = { websiteSku: entry.websiteSku, family: entry.hero.family, capacityMl: entry.hero.capacityMl, color: entry.hero.bottleColor, applicator: entry.websiteSku.includes('Spry') ? 'Perfume Spray' : 'Lotion Pump' };
            const config = { id: entry.websiteSku, bodyId: kit.register.bodyId, family: context.family, capacityMl: context.capacityMl, neck: '18-415', color: context.color, fitment: context.applicator, kit: assembled } as BuilderConfiguration;
            expect(registerVintagePreview(config, assembled.parts), entry.websiteSku).toBeNull();
            const seated = kit.parts.find((part: typeof assembled.parts[number]) => part.slot === 'diptube' && part.throughGlass);
            expect(seated, entry.websiteSku).toBeDefined();
            const builder = renderToStaticMarkup(createElement(BuilderImage, { config, parts: assembled.parts, label: entry.websiteSku, stage: 'complete', showCover: true }));
            expect(builder, entry.websiteSku).toContain('<polygon');
            expect(builder).toContain(`opacity:${seated.throughGlass.opacity}`);
            expect(builder).toContain(encodeURIComponent(entry.bodyImage.url));
            expect(builder).not.toMatch(/NaN|Infinity|\/local-media\//);
            for (const view of ['sidecar', 'capon', 'exploded'] as const) {
                const layout = stageLayout(kit, view, context)!;
                const pdp = renderToStaticMarkup(createElement(PdpStage, {
                    kit, context, pickLine: '', view, availableViews: ['sidecar', 'capon', 'exploded'], onViewChange: () => {},
                    fallbackImageUrls: [], fallbackBodyImageUrl: null, fallbackAlt: entry.websiteSku,
                    callouts: [], caps: [], activeCapId: null, onCapPick: () => {}, glasses: [], onGlassPick: () => {}, activeCapName: null, activeGlassLabel: context.color,
                }));
                expect(pdp).toContain(entry.bodyImage.url.split("/").at(-1)!);
                expect(pdp).not.toMatch(/NaN|Infinity|\/local-media\//);
                if (view === 'exploded') expect(layout.parts.every(part => !part.throughGlass)).toBe(true);
                else {
                    expect(pdp, `${entry.websiteSku}:${view}`).toContain('clip-path:polygon(');
                    expect(pdp).toContain(`opacity:${seated.throughGlass.opacity}`);
                }
            }
        }
    });
    it('checks direct Next builds while keeping approval expiration out of server startup', () => {
        vi.stubEnv('VERCEL_ENV', 'production');
        vi.stubEnv('BB_MEDIA_PRODUCTION_APPROVAL', '');
        expect(() => makeConfig(PHASE_PRODUCTION_BUILD)).toThrow();
        expect(() => makeConfig(PHASE_PRODUCTION_SERVER)).not.toThrow();
    });
});
