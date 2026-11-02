import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import manifest from '@/lib/paper-doll/approved-kits.generated.json';
import type { KitLike } from '@/lib/products/pdp-redesign/stage';
vi.mock('server-only',()=>({}));
import { localPdpComponentKits } from '@/lib/paper-doll/local-component-kits';
const before=JSON.parse(readFileSync('docs/reviews/tulip-amber-seating-2026-11-01/before-kits.json','utf8')).rows as Record<string,KitLike>;
const after=JSON.parse(readFileSync('public/local-kits/tulip-amber-seating-2026-11-01/kits.json','utf8')).rows as Record<string,KitLike>;
const rows=manifest.rows as unknown as Record<string,KitLike>;
describe('explicit Tulip amber collar and internal-mechanism correction',()=>{
 it('corrects all eight sprayer finishes without changing body pixels, scale or closed caps',()=>{
  expect(Object.keys(after)).toHaveLength(8);
  for(const [sku,kit]of Object.entries(after)){expect(rows[sku]).toEqual(kit);expect(kit.parts.find(p=>p.slot==='body')).toEqual(before[sku].parts.find(p=>p.slot==='body'));expect(kit.glassSizing).toEqual(before[sku].glassSizing);expect(kit.parts.find(p=>p.slot==='overcap')).toEqual(before[sku].parts.find(p=>p.slot==='overcap'));const head=kit.parts.find(p=>p.slot==='sprayer')!;expect(head.bounds.bottom).toBeCloseTo(705.2824074074074,6);expect(head.trimBottomPct).toBeGreaterThan(0);kit.parts.forEach((part,i)=>expect(part.image).toEqual(before[sku].parts[i].image));
   const tube=kit.parts.find(p=>p.slot==='diptube'&&p.views?.includes('sidecar'))!,exploded=kit.parts.find(p=>p.slot==='diptube'&&p.views?.includes('exploded'))!,body=kit.parts.find(p=>p.slot==='body')!;expect(tube.zOrder).toBeLessThan(body.zOrder);expect(tube.opacity).toBe(.18);expect(tube.blendMode).toBe('multiply');expect(exploded.opacity).toBeUndefined();expect(exploded.blendMode).toBeUndefined();expect(tube.box!.y+tube.box!.height*(1-tube.trimBottomPct!/100)).toBeCloseTo(tube.bounds.bottom,6);expect(tube.bounds.bottom).toBe(before[sku].parts.find(p=>p.slot==='diptube')!.bounds.bottom);
  }
 });
 it('uses the same corrected recipe during normal localhost navigation and bookmarked previews',()=>{
  vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','');try{const variants=Object.keys(after).map(websiteSku=>({websiteSku}));for(const flag of [undefined,'gpt13']){const local=localPdpComponentKits('localhost:3010',flag,variants);for(const sku of Object.keys(after))expect(local[sku]).toEqual(after[sku]);}}finally{vi.unstubAllEnvs();}
 });
});
