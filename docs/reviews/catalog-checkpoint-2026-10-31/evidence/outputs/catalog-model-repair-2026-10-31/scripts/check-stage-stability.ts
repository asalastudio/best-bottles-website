import fs from 'node:fs';
import { stageLayout,effectiveView,isClosureSlot } from '@/lib/products/pdp-redesign/stage';
import { offBottle } from '@/lib/products/kit-frame';
import { builderPreviewLayout,builderBodyFrame } from '@/lib/bottle-builder/preview-layout';
import { previewParts } from '@/lib/bottle-builder/model';
import { assembledKit } from '@/lib/register/stage-kit';
const out='outputs/catalog-model-repair-2026-10-31/reports/catalog-scale';
const kits=JSON.parse(fs.readFileSync(out+'/'+(process.env.SCALE_KITS_FILE??'kits-after.json'),'utf8'));
const products=JSON.parse(fs.readFileSync('outputs/catalog-model-repair-2026-10-31/sources/catalog-production.json','utf8')).rows;
const clips:any[]=[],mismatches:any[]=[],rows:any[]=[];
for(const p of products){
 const kit=kits[p.websiteSku]??kits[p.graceSku];if(!kit?.glassSizing)continue;
 const body=kit.parts.find((r:any)=>r.slot==='body');let first:any;
 for(const view of ['sidecar','capon','exploded'] as const){
  const l=stageLayout(kit,view,p)!;if(!first)first=l.frame;
  if(JSON.stringify(l.frame)!==JSON.stringify(first))mismatches.push({sku:p.websiteSku,type:'pdp-camera',view});
  const actual=effectiveView(view,kit,p);const parts=[...kit.parts].filter((r:any)=>!r.views||r.views.includes(actual)).sort((a:any,b:any)=>a.zOrder-b.zOrder).map((r:any)=>actual==='exploded'||actual==='sidecar'&&isClosureSlot(r.slot)?offBottle(r):r);
  const per:any[]=[];
  for(let i=0;i<l.parts.length;i++){
   const q=l.parts[i],b={...parts[i].bounds};if(q.clipBottomPct&&parts[i].box)b.bottom=Math.min(b.bottom,parts[i].box.y+parts[i].box.height*(1-q.clipBottomPct/100));
   const box={left:l.frame.x+(b.left/kit.canvas.width*100+q.dxPct)*l.frame.scale,right:l.frame.x+(b.right/kit.canvas.width*100+q.dxPct)*l.frame.scale,top:l.frame.y+(b.top/kit.canvas.height*100+q.dyPct)*l.frame.scale,bottom:l.frame.y+(b.bottom/kit.canvas.height*100+q.dyPct)*l.frame.scale};
   if(box.left<-.1||box.top<-.1||box.right>100.1||box.bottom>100.1)per.push({slot:q.slot,...box});
  }
  if(per.length)clips.push({sku:p.websiteSku,bodyId:kit.register?.bodyId,view,parts:per});
 }
 const assembled=kit.register?assembledKit(kit):kit;
 const config:any={id:p.websiteSku,bodyId:kit.register?.bodyId??'vial-2ml-8-425',family:p.family,capacityMl:p.capacityMl,neck:p.neckThreadSize,color:p.color,fitment:p.applicator,kit:assembled,product:p};
 for(const stage of ['body','fitment','complete'] as const)for(const cover of [false,true]){
  const l=builderPreviewLayout(config,previewParts(config,stage),{stage,showCover:cover});if(!l)continue;
  const f=builderBodyFrame(config,[config],undefined,l);const b=l.layers.find(r=>r.part.slot==='body')!.bounds;
  const span=(b.bottom-(kit.glassSizing.landmarkY??b.top))/f.height*100,foot=(b.bottom-f.y)/f.height*100,axis=(l.anchors.axisX-f.x)/f.width*100;
  if(Math.abs(span-kit.glassSizing.heightPct)>.01||Math.abs(foot-91)>.01||Math.abs(axis-50)>.01)mismatches.push({sku:p.websiteSku,stage,cover,span,foot,axis});
 }
 rows.push(p.websiteSku);
}
fs.writeFileSync(out+'/'+(process.env.SCALE_CHECKS_FILE??'stability-checks.json'),JSON.stringify({checkedAt:new Date().toISOString(),configurations:rows.length,viewsPerConfiguration:3,builderStatesPerConfiguration:6,mismatches,clips,clipMeasurement:'Conservative recorded layer bounds. May include transparent source padding; visible pixel QA remains required.'},null,2));
console.log(JSON.stringify({configurations:rows.length,mismatches:mismatches.length,clipConfigurations:new Set(clips.map(r=>r.sku)).size,clipsByView:Object.fromEntries(['sidecar','capon','exploded'].map(v=>[v,clips.filter(r=>r.view===v).length])),firstClips:clips.slice(0,4)},null,2));
