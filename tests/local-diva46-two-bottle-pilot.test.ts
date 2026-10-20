import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {drawableRegisterKits} from '../src/lib/register/load';
import {getProductHero,getCatalogHero,isLocalReviewHero} from '../src/lib/products/catalog-heroes';
import heroes from '../src/lib/products/local-diva46-pilot-catalog-heroes.json';
import source from '../src/lib/register/local-diva46-tubes.json';
const dir=process.env.BB_DIVA46_PILOT_DIR;
afterEach(()=>vi.unstubAllEnvs());
(dir?describe:describe.skip)('Diva two-bottle catalog pilot',()=>{
 it('preserves every existing assembly and keeps the shared-source limitation explicit',()=>{
  vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','');
  for(const environment of ['production','development']){
   const snapshot=JSON.parse(fs.readFileSync(`${dir}/${environment}-snapshot.json`,'utf8'));
   const before=JSON.parse(fs.readFileSync(`${dir}/${environment}-before-kits.json`,'utf8'));
   const after=drawableRegisterKits(snapshot.register);expect(after).toEqual(before);
   expect(new Set(Object.values(after).map(k=>k.sku)).size).toBe(12);
  }
  expect(source.sourceMatchEvidence).toContain('not exact Diva tube photography');
 });
 it('adds exactly the two requested catalog images and preserves finish and source identity',()=>{
  vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','');
  const skus=['GBDiva46SpryShnSl','GBDivaFrst46SpryShnSl'];expect(heroes.map(h=>h.websiteSku).sort()).toEqual(skus.sort());
  const receipts=JSON.parse(fs.readFileSync('src/lib/products/local-diva46-pilot-provenance.json','utf8'));
  for(const hero of heroes){
   expect(getProductHero(hero.websiteSku)?.url).toBe(hero.url);
   expect(getCatalogHero(hero.groupSlug,[{websiteSku:hero.websiteSku}],hero.websiteSku)?.url).toBe(hero.url);
   const receipt=receipts.find((r:any)=>r.websiteSku===hero.websiteSku);
   expect(receipt.layers).toContainEqual(expect.objectContaining({url:source.url,sha256:source.sha256}));
   expect(createHash('sha256').update(fs.readFileSync(`public${hero.url}`)).digest('hex')).toBe(receipt.sha256);
  }
  for(const sku of source.plates.flatMap(p=>p.websiteSkus).filter(s=>!skus.includes(s)))expect(heroes.map(h=>h.url)).not.toContain(getProductHero(sku)?.url);
  for(const [env,vercel] of [['production',''],['development','1']]){
   vi.stubEnv('NODE_ENV',env);vi.stubEnv('VERCEL',vercel);
   for(const sku of skus)expect(isLocalReviewHero(getProductHero(sku))).toBe(false);
  }
 });
});
