import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import candidate from '../src/lib/register/local-empire-white-pump.json';
import tubes from '../src/lib/register/local-source-tubes.json';
import { localEmpireWhitePumpPayload } from '../src/lib/register/local-empire-white-pump';
import { heroTube } from '../src/lib/register/dip-tubes';
import type { RegisterStagePayload } from '../src/lib/register/stage-kit';
const payload = () => structuredClone({ assemblies: { [candidate.graceSku]: candidate.expectedAssembly }, components: {}, bodies: {}, plates: { [candidate.expectedPlate.plateKey]: candidate.expectedPlate } }) as unknown as RegisterStagePayload;
afterEach(() => vi.unstubAllEnvs());
describe('Empire source pilot guards', () => {
    it('completes only the exact unresolved white SKU locally without mutating its captured receipt', () => {
        vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '');
        const input = payload(), result = localEmpireWhitePumpPayload(input);
        expect(result.assemblies[candidate.graceSku]!.parts).toEqual([{ role: 'pump', componentId: candidate.component.componentId }]);
        expect(input.assemblies[candidate.graceSku]!.renderable).toBe(false);
        expect(candidate.visualApproval).toBe(false);
    });
    it('stays disabled in production and Vercel and never overwrites a completed assembly', () => {
        const input = payload();vi.stubEnv('NODE_ENV', 'production');expect(localEmpireWhitePumpPayload(input)).toBe(input);
        vi.stubEnv('NODE_ENV', 'development');vi.stubEnv('VERCEL', '1');expect(localEmpireWhitePumpPayload(input)).toBe(input);
        vi.stubEnv('VERCEL', ''); input.assemblies[candidate.graceSku]!.renderable = true;expect(localEmpireWhitePumpPayload(input)).toBe(input);
    });
    it('rejects changed source plate, fitment, and product identity', () => {
        vi.stubEnv('NODE_ENV', 'development');vi.stubEnv('VERCEL', '');
        for (const mutate of [
            (x: RegisterStagePayload) => { x.plates[candidate.expectedPlate.plateKey].anchors.seatY++; },
            (x: RegisterStagePayload) => { x.plates[candidate.expectedPlate.plateKey].url += '-changed'; },
            (x: RegisterStagePayload) => { x.assemblies[candidate.graceSku]!.neck = '13-415'; },
            (x: RegisterStagePayload) => { x.assemblies[candidate.graceSku]!.websiteSku = 'another'; },
        ]) { const input = payload();mutate(input);expect(localEmpireWhitePumpPayload(input)).toBe(input); }
    });
    it('requires exact pump geometry for each of the two Empire tube sources', () => {
        vi.stubEnv('NODE_ENV', 'development');vi.stubEnv('VERCEL', '');
        for (const row of tubes.filter(t => t.key.startsWith('empire-50ml'))) {
            const guards = row as typeof row & { expectedPumpLayers: Record<string, any>; componentIds: string[] };
            for (const id of guards.componentIds) {
                const actual = { type: 'lotion-pump', layers: [{ ...structuredClone(guards.expectedPumpLayers[id]), slot: 'pump' }] };
                const assembly = { plateKey: row.expectedPlate.plateKey, parts: [{ role: 'pump', componentId: id }] };
                const frame = { width: 1000, height: 1100, axisX: 500, seatY: 261, pxPerMm: 8.75 };
                expect(heroTube(assembly, { [id]: actual }, row.expectedPlate, frame)?.seated?.url).toBe(row.url);
                actual.layers[0].anchor.y++;
                expect(heroTube(assembly, { [id]: actual }, row.expectedPlate, frame)?.seated?.url).not.toBe(row.url);
            }
        }
    });
    it('preserves recovered component pixel hashes and verifies both tubes have continuous alpha', async () => {
        for (const layer of candidate.component.layers) {
            const bytes = fs.readFileSync(path.join(process.cwd(), 'public', layer.url));
            expect(createHash('sha256').update(bytes).digest('hex')).toBe(layer.fileSha256);
            const raw = await sharp(bytes).ensureAlpha().raw().toBuffer();
            expect(createHash('sha256').update(raw).digest('hex')).toBe(layer.sha256);
        }
        for (const row of tubes.filter(t => t.key.startsWith('empire-50ml'))) {
            const bytes = fs.readFileSync(path.join(process.cwd(), 'public', row.url));
            expect(createHash('sha256').update(bytes).digest('hex')).toBe(row.sha256);
            const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
            const occupied = Array.from({ length: info.height }, (_, y) => Array.from({ length: info.width }, (_, x) => data[(y * info.width + x) * 4 + 3]).some(a => a > 15));
            expect(occupied.slice(occupied.indexOf(true), occupied.lastIndexOf(true) + 1).every(Boolean)).toBe(true);
        }
    });
});
