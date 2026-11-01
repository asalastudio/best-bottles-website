import fs from 'node:fs';
import { stageLayout, type KitLike } from '@/lib/products/pdp-redesign/stage';
const root=process.cwd();
const rows=JSON.parse(fs.readFileSync(root+'/public/local-kits/vial-2ml-source-2026-10-31/kits.json','utf8')).rows as Record<string,KitLike>;
const results=[];
for(const kit of Object.values(rows)) {
 const body=kit.parts.find(p=>p.slot==='body')!;
 for(const view of ['sidecar','capon','exploded'] as const) {
  const layout=stageLayout(kit,view,{family:'Vial',capacityMl:2,color:'Clear',applicator:'Cap/Closure',websiteSku:kit.sku})!;
  results.push({sku:kit.sku,view,frame:layout.frame,glassHeightPct:(body.bounds.bottom-body.bounds.top)*layout.frame.scale/kit.canvas.height*100,glassFootPct:layout.frame.y+body.bounds.bottom*layout.frame.scale/kit.canvas.height*100,anchorFootPct:layout.frame.y+kit.anchors.baselineY*layout.frame.scale/kit.canvas.height*100,bodyBounds:body.bounds});
 }
}
console.log(JSON.stringify(results,null,2));
