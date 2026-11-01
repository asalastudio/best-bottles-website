import fs from 'node:fs';
import path from 'node:path';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';
import { drawableRegisterKits } from '@/lib/register/load';
import { glassFrame, stageLayout, stageEnvelope, stageFrameKey, type KitLike } from '@/lib/products/pdp-redesign/stage';
const OUT=path.resolve('outputs/catalog-model-repair-2026-10-31/reports/catalog-scale');
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const products=read('outputs/catalog-model-repair-2026-10-31/sources/catalog-production.json').rows;
const env=fs.readFileSync('.env.local','utf8');
const url=env.match(/^NEXT_PUBLIC_CONVEX_URL=(.+)$/m)![1].trim();
const oldLocal=read(env.match(/^BUILDER_LOCAL_KITS=(.+)$/m)![1].trim());
async function main(){
 let payload:any;
 const file=path.join(OUT,'register-payload-'+new URL(url).hostname.split('.')[0]+'.json');
 const prior=path.join(OUT,'local-register-payload.json');
 if(!fs.existsSync(file)&&fs.existsSync(prior)&&read(prior).endpoint===url)fs.copyFileSync(prior,file);
 if(fs.existsSync(file))payload=read(file).payload;
 else {
  const c=new ConvexHttpClient(url);payload={plates:{},bodies:{},components:{},assemblies:{}};
  const skus=[...new Set(products.map((p:any)=>p.graceSku).filter(Boolean))] as string[];
  for(let i=0;i<skus.length;i+=50){const part:any=await c.query(api.registerStage.forSkus,{graceSkus:skus.slice(i,i+50)});for(const k of Object.keys(payload))Object.assign(payload[k],part[k]);if(i%500===0)console.log('Fetched',i+50,'of',skus.length);}
  fs.writeFileSync(file,JSON.stringify({checkedAt:new Date().toISOString(),endpoint:url,readOnly:true,payload}));
 }
 const kits:any=drawableRegisterKits(payload);
 for(const sku of oldLocal.defaultPdpSkus??[]){if(oldLocal.rows[sku])kits[sku]=oldLocal.rows[sku];}
 const policy=read(path.join(OUT,'scale-policy.json'));const target=new Map(policy.rows.map((r:any)=>[r.bodyId,r]));
 const envelopeLists:Record<string,KitLike[]>={};
 for(const p of products){const k=kits[p.websiteSku]??kits[p.graceSku];if(!k?.register)continue;const key=stageFrameKey(k.register.bodyId,p.applicator);(envelopeLists[key]??=[]).push(k);}
 const envelopes=Object.fromEntries(Object.entries(envelopeLists).map(([k,v])=>[k,stageEnvelope(v)!]));
 const rows=[];
 for(const p of products){
  const kit=kits[p.websiteSku]??kits[p.graceSku];
  const base={sku:p.websiteSku,graceSku:p.graceSku,family:p.family,capacityMl:p.capacityMl,color:p.color,applicator:p.applicator,groupId:p.productGroupId};
  if(!kit){rows.push({...base,status:'no-register-kit',note:'Legacy kit or fallback image requires a separate measured source.'});continue;}
  const body=kit.parts.find((part:any)=>part.slot==='body');if(!body){rows.push({...base,status:'no-body-layer'});continue;}
  const bid=kit.register?.bodyId??(oldLocal.rows[p.websiteSku]?'vial-2ml-8-425':null);
  const t:any=target.get(bid);const plate=kit.register?payload.plates[kit.register.plateKey]:null;
  let landmarkY:number|undefined;
  if(kit.glassSizing && !kit.register)landmarkY=body.bounds.top;
  else if(plate){
   const isRim=t?.landmark==='full-glass'||t?.landmark==='full-product'||(t?.landmark==='closure-seat'&&/Ground|Plug|snap/i.test(payload.bodies[bid]?.neck??''));
   const a=isRim?plate.anchors.seatY:plate.anchors.shoulderY;
   if(a!=null)landmarkY=body.box.y+a*body.box.height/plate.height;
   // Photographic Elegant substitutions are registered directly by shoulder-to-foot bounds.
   if(body.image.url!==plate.url && bid.startsWith('elegant-'))landmarkY=body.bounds.top;
  }
  const options=glassFrame({kit,applicator:p.applicator},[{kit,applicator:p.applicator}],envelopes);
  const views:any={};
  for(const v of ['sidecar','capon','exploded'] as const){const layout=stageLayout(kit,v,p,options)!;const f=layout.frame;views[v]={frame:f,spanPct:landmarkY==null?null:(body.bounds.bottom-landmarkY)*f.scale/kit.canvas.height*100,baselinePct:f.y+body.bounds.bottom*f.scale/kit.canvas.height*100,axisPct:f.x+kit.anchors.axisX*f.scale/kit.canvas.width*100};}
  rows.push({...base,bodyId:bid,plateKey:kit.register?.plateKey,status:landmarkY==null?'unmeasured':'measured',targetPct:t?.targetPct,landmark:t?.landmark,landmarkY,bodyBounds:body.bounds,bodyBox:body.box,bodyUrl:body.image.url,canvas:kit.canvas,views,deltaPct:landmarkY==null?null:views.sidecar.spanPct-t.targetPct});
 }
 const tag=process.env.SCALE_AUDIT_TAG??'before';
 fs.writeFileSync(path.join(OUT,`stage-${tag}.json`),JSON.stringify({checkedAt:new Date().toISOString(),endpoint:url,scope:'Local register stage layout, evaluated over the production SKU inventory. All captured register configurations contribute to envelopes. No claim of browser or fallback-image coverage.',rows},null,2));
 fs.writeFileSync(path.join(OUT,`kits-${tag}.json`),JSON.stringify(kits));
 const measured=rows.filter((r:any)=>r.status==='measured');
 console.log(JSON.stringify({rows:rows.length,measured:measured.length,noKit:rows.filter(r=>r.status==='no-register-kit').length,withinHalfPoint:measured.filter((r:any)=>Math.abs(r.deltaPct)<=.5).length,baselineWithinHalfPoint:measured.filter((r:any)=>Math.abs(r.views.sidecar.baselinePct-91)<=.5).length}));
}
main().catch(e=>{console.error(e);process.exit(1)});
