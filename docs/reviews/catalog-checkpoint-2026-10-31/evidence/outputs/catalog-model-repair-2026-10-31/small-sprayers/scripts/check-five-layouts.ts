import fs from 'node:fs';
import {stageLayout,type KitLike} from '@/lib/products/pdp-redesign/stage';
const {rows}=JSON.parse(fs.readFileSync('public/local-kits/cylinder5-profiles-2026-10-31/kits.json','utf8')) as {rows:Record<string,KitLike>};
const results=Object.entries(rows).map(([sku,kit])=>{
 const views=['sidecar','capon','exploded'].map(view=>{
 const l=stageLayout(kit,view as 'sidecar',{})!;
 const body=l.parts.find(p=>p.slot==='body');return {view,layout:l,body};
 });
 return {sku,views};
});
fs.writeFileSync('outputs/catalog-model-repair-2026-10-31/small-sprayers/five-layouts.json',JSON.stringify(results,null,2));console.log(results.length,'five ml kits; three views each');
