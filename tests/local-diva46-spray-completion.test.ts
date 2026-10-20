import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {drawableRegisterKits} from '../src/lib/register/load';
import {getProductHero,getCatalogHero,isLocalReviewHero} from '../src/lib/products/catalog-heroes';
import pilot from '../src/lib/products/local-diva46-pilot-catalog-heroes.json';
import additional from '../src/lib/products/local-diva46-additional-catalog-heroes.json';
import source from '../src/lib/register/local-diva46-tubes.json';
const dir=process.env.BB_DIVA46_COMPLETION_DIR;
afterEach(()=>vi.unstubAllEnvs());
(dir?describe:describe.skip)('Diva standard spray local completion',()=>{
 it('keeps all twelve source assemblies unchanged in both captured environments',()=>{
  vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','');
  for(const environment of ['production','development']){
   const snapshot=JSON.parse(fs.readFileSync(`${dir}/${environment}-snapshot.json`,'utf8'));
   const before=JSON.parse(fs.readFileSync(`${dir}/${environment}-before-kits.json`,'utf8'));
   const after=drawableRegisterKits(snapshot.register);expect(after).toEqual(before);
   expect(new Set(Object.values(after).map(k=>k.sku)).size).toBe(12);
   for(const sku of source.plates.flatMap(p=>p.websiteSkus)){
    const kit=after[sku],head=kit.parts.find(p=>p.slot==='sprayer')!;
    const component=source.components.find(c=>c.componentId===head.componentId)!;
    const layer=component.layers.find(l=>l.slot==='sprayer')!;
    for(const tube of kit.parts.filter(p=>p.slot==='diptube')){
     expect(tube.image.url).toBe(source.url);
     expect(tube.bounds.top).toBeCloseTo(head.box.y+layer.solidBottomY*head.box.height/layer.height-2,1);
     expect(tube.box.width/source.width).toBeCloseTo(tube.box.height/source.height,3);
    }
   }
  }
 });
 it('maps twelve exact catalog images, preserves approved pilot pixels and remains local',()=>{
  vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','');
  const heroes=[...pilot,...additional];expect(heroes).toHaveLength(12);expect(additional).toHaveLength(10);
  expect(new Set(heroes.map(h=>h.websiteSku)).size).toBe(12);
  const receipts=JSON.parse(fs.readFileSync('src/lib/products/local-diva46-completion-provenance.json','utf8'));
  const oldReceipts=JSON.parse(fs.readFileSync('src/lib/products/local-diva46-pilot-provenance.json','utf8'));
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
