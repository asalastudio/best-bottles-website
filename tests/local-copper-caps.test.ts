import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawableRegisterKits } from '../src/lib/register/load';
import source from '../src/lib/register/local-copper-caps.json';
import { localRound78Tubes } from '../src/lib/register/local-round78-tubes';
const file = process.env.BB_ROUND78_LOTION_SNAPSHOT;
afterEach(() => vi.unstubAllEnvs());
(process.env.BB_COPPER_SOURCE_DIR ? it : it.skip)('removes only pure white retouch paint while preserving every original copper pixel and its alpha', async () => {
 const root=process.env.BB_COPPER_SOURCE_DIR;
 if(!root) throw new Error('BB_COPPER_SOURCE_DIR is required for source pixel verification');
 const before=await sharp(path.join(root,source.sourceFileName)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const bytes=fs.readFileSync(path.join(process.cwd(),'public',source.url));
 expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256);
 const after=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 expect(after.info).toEqual(before.info);
 const expected=Buffer.from(before.data);let removed=0;
 for(let i=0;i<expected.length;i+=4){
  if(expected[i+3]&&expected[i]===255&&expected[i+1]===255&&expected[i+2]===255){expected[i+3]=0;removed++;}
 }
 // One byte comparison checks all source colour and surviving alpha values.
 // Per-pixel test assertions needlessly exceeded the suite's shared CPU budget.
 expect(after.data.equals(expected)).toBe(true);
 expect(removed).toBe(source.cleanup.removedPureWhitePixels);
});
(file?describe:describe.skip)('exact Round copper cap review',()=>{
 it('changes only the overcap image for the two exact SKUs and rejects changed metadata or hosted mode',()=>{
  const payload=JSON.parse(fs.readFileSync(file!,'utf8')).register;
  vi.stubEnv('NODE_ENV','production');const baseline=drawableRegisterKits(payload);
  vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','');const after=drawableRegisterKits(payload);
  for(const sku of source.websiteSkus){
   const old=localRound78Tubes(baseline[sku],payload.plates[baseline[sku].register.plateKey],payload.components).parts.find(p=>p.slot==='overcap')!,part=after[sku].parts.find(p=>p.slot==='overcap')!;
   expect(part.image.url).toBe(source.url);expect(part.box).toEqual(old.box);expect(part.bounds).toEqual(old.bounds);
   expect(part.exploded).toEqual(old.exploded);expect(after[sku].parts.find(p=>p.slot==='body')).toEqual(baseline[sku].parts.find(p=>p.slot==='body'));
  }
  for(const sku of Object.keys(baseline).filter(s=>!source.websiteSkus.includes(baseline[s].sku))){
   expect(after[sku]?.parts.find(p=>p.slot==='overcap')?.image.url).toBe(baseline[sku].parts.find(p=>p.slot==='overcap')?.image.url);
  }
  const changed=structuredClone(payload);changed.components[source.componentId].layers.find((p:any)=>p.slot==='overcap').anchor.x++;
  expect(drawableRegisterKits(changed)[source.websiteSkus[0]].parts.find(p=>p.slot==='overcap')!.image.url).toBe(source.expectedLayer.url);
  vi.stubEnv('VERCEL','1');expect(drawableRegisterKits(payload)[source.websiteSkus[0]].parts.find(p=>p.slot==='overcap')!.image.url).toBe(source.expectedLayer.url);
 });
});
