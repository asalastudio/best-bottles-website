import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {drawableRegisterKits} from '../src/lib/register/load';
import {getProductHero,getCatalogHero,isLocalReviewHero} from '../src/lib/products/catalog-heroes';
import pilot from '../src/lib/products/local-round78-lotion-pilot-catalog-heroes.json';
import additional from '../src/lib/products/local-round78-lotion-additional-catalog-heroes.json';
import source from '../src/lib/register/local-round78-lotion-tubes.json';
const dir=process.env.BB_ROUND78_LOTION_COMPLETION_DIR;
afterEach(()=>vi.unstubAllEnvs());
(dir?describe:describe.skip)('Round lotion local completion',()=>{
 it('keeps all fourteen source assemblies unchanged in both captured environments',()=>{
  vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','');
  for(const environment of ['production','development']){
   const snapshot=JSON.parse(fs.readFileSync(`${dir}/${environment}-snapshot.json`,'utf8'));
   const before=JSON.parse(fs.readFileSync(`${dir}/${environment}-before-kits.json`,'utf8'));
   const after=drawableRegisterKits(snapshot.register);expect(after).toEqual(before);
   expect(new Set(Object.values(after).map(k=>k.sku)).size).toBe(14);

  }
 });
 it('maps fourteen exact catalog images, preserves approved pilot pixels and remains local',()=>{
  vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','');
  const heroes=[...pilot,...additional];expect(heroes).toHaveLength(14);expect(additional).toHaveLength(12);
  expect(new Set(heroes.map(h=>h.websiteSku)).size).toBe(14);
  const receipts=JSON.parse(fs.readFileSync('src/lib/products/local-round78-lotion-completion-provenance.json','utf8'));
  const oldReceipts=JSON.parse(fs.readFileSync('src/lib/products/local-round78-lotion-pilot-provenance.json','utf8'));
  for(const hero of heroes){
   const receipt=receipts.find((r:any)=>r.websiteSku===hero.websiteSku);
   expect(getProductHero(hero.websiteSku)?.url).toBe(hero.url);
   expect(getCatalogHero(hero.groupSlug,[{websiteSku:hero.websiteSku}],hero.websiteSku)?.url).toBe(hero.url);
   expect(createHash('sha256').update(fs.readFileSync(`public${hero.url}`)).digest('hex')).toBe(receipt.sha256);
   expect(receipt.layers).toContainEqual(expect.objectContaining({url:source.url,sha256:source.sha256}));
   const accepted=oldReceipts.find((r:any)=>r.websiteSku===hero.websiteSku);if(accepted)expect(receipt.sha256).toBe(accepted.sha256);
  }
  for(const [env,vercel] of [['production',''],['development','1']]){
   vi.stubEnv('NODE_ENV',env);vi.stubEnv('VERCEL',vercel);
   for(const hero of heroes)expect(isLocalReviewHero(getProductHero(hero.websiteSku))).toBe(false);
  }
 });
});
