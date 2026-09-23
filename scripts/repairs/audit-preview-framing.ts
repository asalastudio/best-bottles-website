import fs from "node:fs";
import path from "node:path";
import { builderBodyFrame, builderPreviewLayout } from "../../src/lib/bottle-builder/preview-layout";
import { previewParts, type BuilderBody, type BuilderConfiguration } from "../../src/lib/bottle-builder/model";
import { pdpStageFrame } from "../../src/lib/products/pdp-stage-frame";
import { withDetachedCapOffsets } from "../../src/lib/products/kit-frame";
const source=process.argv[2];
if(!source) throw Error("Pass the read-only family audit directory");
const bodies=JSON.parse(fs.readFileSync(path.join(source,"production/builder-bodies.json"),"utf8")) as BuilderBody[];
const local=JSON.parse(fs.readFileSync("data/repairs/four-family-components-2026-09-22/local-kits.json","utf8")).rows;
const results=[];
for(const body of bodies) for(const color of new Set(body.configurations.map(c=>c.color))) {
 const allCandidates=body.configurations.map(c=>({...c,kit:local[c.id]??c.kit}));
 const candidates=allCandidates.filter(c=>c.color===color);
 const reference=candidates.find(c=>c.fitment==="Vintage Bulb Sprayer" && c.kit?.completeness==="full")
 ?? candidates.find(c=>c.kit?.completeness==="full"&& c.fitment!=="Reducer") ?? candidates.find(c=>c.kit?.completeness==="full") ?? candidates[0];
 const rows=[];
 for(const c of candidates) {
  for(const stage of ["body","fitment","complete"] as const) for(const showCover of [false,true]) {
   const layout=builderPreviewLayout(c,previewParts(c,stage),{stage,showCover,bodyReference:reference});
   if(!layout?.layers.length)continue;
   const frame=builderBodyFrame(c,allCandidates,reference,layout);
   const outside=layout.layers.filter(({bounds:b})=>b.left<frame.x||b.right>frame.x+frame.width||b.top<frame.y||b.bottom>frame.y+frame.height);
   const glass=layout.layers.find(l=>l.part.slot==="body")?.bounds;
   rows.push({sku:c.id,stage,showCover,frame,bodyWidth:glass?(glass.right-glass.left)/frame.width:null,outside:outside.map(l=>l.part.slot)});
  }
 }
 const widths=rows.map(r=>r.bodyWidth).filter((n):n is number=>n!=null);
 results.push({bodyId:body.id,color,views:rows.length,clipped:rows.filter(r=>r.outside.length),
  cameraCount:new Set(rows.map(r=>JSON.stringify(r.frame))).size,
  bodyWidthSpread:widths.length?Math.max(...widths)-Math.min(...widths):null,
  differingSources:rows.filter(r=>r.stage==="complete"&&!r.showCover).map(r=>({sku:r.sku,bodyWidth:r.bodyWidth})),
 });
}
const kits=JSON.parse(fs.readFileSync(path.join(source,"production/served-kits.json"),"utf8"));
const pdp=[];
for(const [sku,raw] of Object.entries(kits)) {
 const kit=(local[sku]??raw) as NonNullable<BuilderConfiguration["kit"]>;
 if(!kit?.parts?.length)continue;
 const parts=withDetachedCapOffsets(kit.parts);
 for(const view of ["assembled","capOff"] as const) {
  const frame=pdpStageFrame({view,parts});
  const clipped=parts.filter(p=>{
   const delta=view==="capOff"&&["cap","overcap"].includes(p.slot)?p.exploded:{dx:0,dy:0};
   return (p.bounds.left+delta.dx)*frame.scale+frame.x*10 < 40-1e-6
    ||(p.bounds.right+delta.dx)*frame.scale+frame.x*10>960+1e-6
    ||(p.bounds.top+delta.dy)*frame.scale+frame.y*11<44-1e-6
    ||(p.bounds.bottom+delta.dy)*frame.scale+frame.y*11>1056+1e-6;
  });
  pdp.push({sku,view,clipped:clipped.map(p=>p.slot)});
 }
}
const report={checkedAt:new Date().toISOString(),source,scope:"Saved production audit plus nine locally corrected Circle kits. Bounds checks do not replace source or visual approval.",
 builder:{bodies:results.length,views:results.reduce((s,r)=>s+r.views,0),clipped:results.flatMap(r=>r.clipped).length,unstableCameras:results.filter(r=>r.cameraCount>1).length,results},
 pdp:{views:pdp.length,clipped:pdp.filter(r=>r.clipped.length)}};
fs.writeFileSync("data/repairs/four-family-components-2026-09-22/framing-audit.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({builderViews:report.builder.views,builderClipped:report.builder.clipped,unstableCameras:report.builder.unstableCameras,pdpViews:pdp.length,pdpClipped:report.pdp.clipped.length,
 bodySourceVariation:results.filter(r=>(r.bodyWidthSpread??0)>.001).map(r=>({id:r.bodyId,color:r.color,spread:r.bodyWidthSpread}))},null,2));
if(report.builder.clipped ||report.pdp.clipped.length ||report.builder.unstableCameras)process.exitCode=1;
