import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getCustomerFacingProductName } from '@/lib/products/customer-facing-names';
import { productCopyFor } from '@/lib/products/item-description/product-copy';
import { stageLayout, type KitLike } from '@/lib/products/pdp-redesign/stage';
const localReview='docs/reviews/catalog-checkpoint-2026-10-31/runtime/public/local-kits/small-sprayers-2026-10-31/kits.json';
const rows=JSON.parse(readFileSync(localReview,'utf8')).rows as Record<string,KitLike>;
describe('small sprayer local review',()=>{
 it('uses 3.3 ml despite the historical 3 ml text',()=>{
  for(const websiteSku of ['GBSpry3mlClBlk','GBSpry3mlClWht']) {
   expect(getCustomerFacingProductName({variant:{websiteSku,capacity:'3 ml',capacityMl:3.3,family:'Cylinder',color:'Clear',applicator:'Fine Mist Sprayer'}}).displayName).toMatch(/^3.3 ml/);
   expect(productCopyFor({websiteSku})?.title).toMatch(/^3.3 ml/);
   expect(productCopyFor({websiteSku})?.bullets.find(([label])=>label==='Included')?.[1]).toContain('one clear protective overcap');
  }
 });
 it('keeps all four complete glass bodies and one common clear cover across finishes',()=>{
  expect(Object.keys(rows)).toHaveLength(4);
  const caps=Object.values(rows).map(k=>k.parts.find(p=>p.slot==='overcap')!.image.url);
  expect(new Set(caps).size).toBe(1);
  for(const kit of Object.values(rows)){
   expect(kit.parts.filter(p=>p.slot==='body')).toHaveLength(1);
   expect(kit.glassSizing?.baselinePct).toBe(91);
   for(const view of ['sidecar','capon','exploded'] as const){
    const layout=stageLayout(kit,view,{});expect(layout).not.toBeNull();
    expect(layout!.parts.filter(p=>p.slot==='diptube')).toHaveLength(1);
    expect(layout!.parts.filter(p=>p.slot==='overcap')).toHaveLength(1);
   }
  }
 });
});
