import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifest from '@/lib/paper-doll/approved-kits.generated.json';
import { cylinderMasterSku } from '@/lib/products/cylinder-master';
import { stageLayout, type KitLike } from '@/lib/products/pdp-redesign/stage';
const report=JSON.parse(readFileSync('docs/reviews/tulip-pour-reconciliation-2026-11-01/reconciliation.json','utf8'));
const rows=manifest.rows as unknown as Record<string,KitLike>;
describe('Tulip pour hero and product-page master parity',()=>{
 it('routes all 19 registered pour choices through the same shared master resolver',()=>{
  expect(report.records).toHaveLength(19);
  for(const r of report.records){expect(cylinderMasterSku(r.sku)).toBe(r.sku);const k=rows[r.sku],reference=rows[r.glass==='Amber'?'GBTulipAmb5SpryBlkSh':'GBTulip6SpryBlkSh'];expect(k.parts.find(p=>p.slot==='body'),r.sku).toEqual(reference.parts.find(p=>p.slot==='body'));expect(k.glassSizing,r.sku).toEqual(reference.glassSizing);
   const contexts={websiteSku:r.sku,family:'Cylinder',applicator:null};const layouts=(['sidecar','capon','exploded'] as const).map(v=>stageLayout(k,v,contexts)!);for(const l of layouts){expect(l.frame).toEqual(layouts[0].frame);expect(l.parts.find(p=>p.slot==='body')).toEqual(layouts[0].parts.find(p=>p.slot==='body'));}
  }
 });
 it('retains the unresolved clear shiny-black identity as a hold instead of borrowing a cap',()=>{
  expect(report.legacyVariants).toBe(20);expect(report.exceptions.map((r:{sku:string})=>r.sku)).toEqual(['GBTulip6BlkShSht']);expect(rows.GBTulip6BlkShSht).toBeUndefined();
 });
});
