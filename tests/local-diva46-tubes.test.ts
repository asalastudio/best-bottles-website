import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawableRegisterKits } from '../src/lib/register/load';
import source from '../src/lib/register/local-diva46-tubes.json';
import { localDiva46Tubes } from '../src/lib/register/local-diva46-tubes';
const file=process.env.BB_DIVA46_SNAPSHOT;
afterEach(()=>vi.unstubAllEnvs());
it('reuses the unchanged native sprayer source without claiming Diva source approval',()=>{
 const bytes=fs.readFileSync(path.join(process.cwd(),'public',source.url));expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256);
 expect(source.visuallyApproved).toBe(false);expect(source.sourceMatchEvidence).toContain('not exact Diva tube photography');
});
(file?describe:describe.skip)('Diva 46 native source reuse',()=>{
 it('replaces twelve broken tubes while preserving body and hardware, source proportions and the captured exposed endpoint',()=>{
  const payload=JSON.parse(fs.readFileSync(file!,'utf8')).register;
  vi.stubEnv('NODE_ENV','production');const old=drawableRegisterKits(payload);
  vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','');const current=Object.fromEntries(Object.entries(old).map(([key,kit])=>[key,localDiva46Tubes(kit,payload.plates[kit.register.plateKey],payload.components)]));
  const skus=source.plates.flatMap(p=>p.websiteSkus);expect(skus).toHaveLength(12);
  for(const sku of skus){
   const kit=current[sku],before=old[sku];const body=kit.parts.find(p=>p.slot==='body')!,head=kit.parts.find(p=>p.slot==='sprayer')!;
   expect(body).toEqual(before.parts.find(p=>p.slot==='body'));
   for(const slot of ['sprayer','overcap']){const a=kit.parts.find(p=>p.slot===slot)!,b=before.parts.find(p=>p.slot===slot)!;expect(a.box).toEqual(b.box);expect(a.image).toEqual(b.image);}
   const seated=kit.parts.find(p=>p.slot==='diptube'&&p.views?.includes('capon'))!,exposed=kit.parts.find(p=>p.slot==='diptube'&&p.views?.includes('exploded'))!;
   expect(seated.image.url,sku).toBe(source.url);expect(exposed.image.url,sku).toBe(source.url);
   expect(seated.box.width/source.width).toBeCloseTo(seated.box.height/source.height,3);
   const pump=source.components.find(c=>c.componentId===head.componentId)!.layers.find(l=>l.slot==='sprayer')!;
   const solid=head.box.y+pump.solidBottomY*head.box.height/pump.height;
   expect(seated.bounds.top,sku).toBeCloseTo(solid-2,1);
   expect(exposed.bounds.bottom,sku).toBeCloseTo(before.parts.find(p=>p.slot==='diptube'&&p.views?.includes('exploded'))!.bounds.bottom,1);
   expect(seated.bounds.bottom,sku).toBeLessThan(body.bounds.bottom-source.innerFloorMmAboveFoot*kit.anchors.pxPerMm!);
   expect(seated.throughGlass?.opacity).toBe(kit.register.glass==='Frosted'?0.22:0.65);expect(exposed.throughGlass).toBeUndefined();
  }
  for(const kit of Object.values(old).filter(kit=>!skus.includes(kit.sku))){expect(localDiva46Tubes(kit,payload.plates[kit.register.plateKey],payload.components)).toBe(kit);}
 });
 it('rejects changed plate or mechanism metadata, wrong exact SKU and Vercel',()=>{
  const payload=JSON.parse(fs.readFileSync(file!,'utf8')).register,sku=source.plates[0].websiteSkus[0];
  vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','');
  const changed=structuredClone(payload);changed.plates[source.plates[0].expectedPlate.plateKey].anchors.baselineY++;
  expect(drawableRegisterKits(changed)[sku].parts.find(p=>p.slot==='diptube')!.image.url).not.toBe(source.url);
  const componentChanged=structuredClone(payload);componentChanged.components[drawableRegisterKits(payload)[sku].parts.find(p=>p.slot==='sprayer')!.componentId!].layers[0].anchor.x++;
  expect(drawableRegisterKits(componentChanged)[sku].parts.find(p=>p.slot==='diptube')!.image.url).not.toBe(source.url);
  vi.stubEnv('NODE_ENV','production');const original=drawableRegisterKits(payload)[sku];vi.stubEnv('NODE_ENV','development');
  const moved=structuredClone(original);moved.parts.find(p=>p.slot==='diptube'&&p.views?.includes('exploded'))!.bounds.bottom--;
  expect(localDiva46Tubes(moved,payload.plates[moved.register.plateKey],payload.components)).toBe(moved);
  vi.stubEnv('VERCEL','1');expect(drawableRegisterKits(payload)[sku].parts.find(p=>p.slot==='diptube')!.image.url).not.toBe(source.url);
 });
});
