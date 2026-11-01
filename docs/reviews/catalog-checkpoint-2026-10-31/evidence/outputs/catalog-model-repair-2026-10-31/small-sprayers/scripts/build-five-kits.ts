import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { kitFromRegister, type RegisterStagePayload } from '@/lib/register/stage-kit';
const base=path.resolve('outputs/catalog-model-repair-2026-10-31/small-sprayers');
const dest=path.resolve('public/local-kits/cylinder5-profiles-2026-10-31');
async function main(){
fs.mkdirSync(dest,{recursive:true});
const payload=JSON.parse(fs.readFileSync(path.resolve(base,'../reports/catalog-scale/register-payload-precise-raccoon-123.json'),'utf8')).payload as RegisterStagePayload;
const images:Record<string,any>={};
for(const [glass,slug] of [['Clear','clear'],['Cobalt Blue','cobalt']]){
 const file=`glass-5-${slug}-measured-v19.png`,data=fs.readFileSync(path.join(base,'renders',file)),meta=JSON.parse(fs.readFileSync(path.join(base,'renders',file.replace('.png','.json')),'utf8'));
 const lockPath=path.join(base,'approved-five-v19.json');
 if(fs.existsSync(lockPath)){
  const lock=JSON.parse(fs.readFileSync(lockPath,'utf8'));
  const approved=lock.files.find((entry:{source:string})=>entry.source.endsWith('/'+file));
  if(!approved || approved.sha256!==crypto.createHash('sha256').update(data).digest('hex')) throw Error('Approved 5 ml body changed: '+file+'. Create a separate review candidate before replacing the approved master.');
 }
 fs.copyFileSync(path.join(base,'renders',file),path.join(dest,file));
 const {data:pixels,info}=await sharp(fs.readFileSync(path.join(base,"renders",`glass-5-${slug}-measured-v9.png`))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let l=info.width,t=info.height,r=0,b=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(pixels[(y*info.width+x)*4+3]>6){l=Math.min(l,x);r=Math.max(r,x+1);t=Math.min(t,y);b=Math.max(b,y+1);}
 images[glass]={image:{url:'/local-kits/cylinder5-profiles-2026-10-31/'+file,key:'',sha256:crypto.createHash('sha256').update(data).digest('hex'),bytes:data.length,width:info.width,height:info.height},meta,bounds:{l,t,r,b}};
}
const tubeFile='mechanism-5-measured-v6.png',tubeData=fs.readFileSync(path.join(base,'renders',tubeFile));
fs.copyFileSync(path.join(base,'renders',tubeFile),path.join(dest,tubeFile));
const tubeMeta=JSON.parse(fs.readFileSync(path.join(base,'renders','mechanism-5-measured-v6.json'),'utf8'));
const tubeSize=await sharp(tubeData).metadata();
const tubeImage={url:'/local-kits/cylinder5-profiles-2026-10-31/'+tubeFile,key:'',sha256:crypto.createHash('sha256').update(tubeData).digest('hex'),bytes:tubeData.length,width:tubeSize.width!,height:tubeSize.height!};
const rows:Record<string,any>={};const checks=[];
for(const [graceSku,assembly] of Object.entries(payload.assemblies)){
 if(!assembly||assembly.bodyId!=='cylinder-5ml-13-415'||!assembly.websiteSku)continue;
 const kit=kitFromRegister(graceSku,payload);if(!kit)throw Error('Missing kit: '+graceSku);
 const master=images[assembly.glass];if(!master)throw Error('Unsupported glass '+assembly.glass);
 const body=kit.parts.find(p=>p.slot==='body')!;const before=structuredClone(kit);
 const scale=kit.anchors.pxPerMm!/25;
 const x=kit.anchors.axisX-(master.meta.axis-master.meta.crop[0])*scale;
 const y=body.bounds.bottom-master.bounds.b*scale;
 body.box={x,y,width:master.image.width*scale,height:master.image.height*scale};body.image=master.image;
 body.bounds={left:x+master.bounds.l*scale,top:y+master.bounds.t*scale,right:x+master.bounds.r*scale,bottom:y+master.bounds.b*scale};
 const sprayer=kit.parts.find(p=>p.slot==='sprayer');
 if(sprayer){
  const box={x:body.box.x+(tubeMeta.crop[0]-master.meta.crop[0])*scale,y:body.box.y+(tubeMeta.crop[1]-master.meta.crop[1])*scale,width:tubeImage.width*scale,height:tubeImage.height*scale};
  const mechanism={slot:'diptube' as const,variantKey:null,zOrder:body.zOrder+1,explodeIndex:sprayer.explodeIndex,box,bounds:{left:box.x,top:box.y,right:box.x+box.width,bottom:box.y+box.height},assembled:{x:0,y:0},exploded:{dx:0,dy:0},image:tubeImage,image2x:null,mask:null,derivation:'psd-layer' as const,componentId:sprayer.componentId};
  kit.parts=kit.parts.filter(p=>p.slot!=='diptube');
  kit.parts.push({...mechanism,views:['sidecar','capon'],opacity:assembly.glass==='Clear'?.45:.12},{...mechanism,views:['exploded']});
 }
 // Keep the approved framing datum, so a component change cannot resize the glass.
 if(!kit.glassSizing)throw Error('Missing approved scale '+graceSku);
 kit.glassSizing={...kit.glassSizing,landmarkY:body.box.y+(master.meta.shoulder-master.meta.crop[1])*scale,source:'Jordan caliper measurements 2026-10-31: shoulder 40.10 mm; approved 36.5% family framing and 91% foot preserved'};
 rows[assembly.websiteSku]=kit;
 checks.push({sku:assembly.websiteSku,graceSku,glass:assembly.glass,bodyImage:body.image.url,tubeReplaced:Boolean(sprayer),closuresUnchanged:JSON.stringify(before.parts.filter(p=>!['body','diptube'].includes(p.slot)))===JSON.stringify(kit.parts.filter(p=>!['body','diptube'].includes(p.slot))),scaleTargetUnchanged:before.glassSizing?.heightPct===kit.glassSizing?.heightPct&&before.glassSizing?.baselinePct===kit.glassSizing?.baselinePct,anchorsUnchanged:JSON.stringify(before.anchors)===JSON.stringify(kit.anchors)});
}
fs.writeFileSync(path.join(dest,'kits.json'),JSON.stringify({rows,defaultPdpSkus:Object.keys(rows)},null,2));fs.writeFileSync(path.join(base,'five-body-integration.json'),JSON.stringify(checks,null,2));console.log('Local five ml body replacements:',checks.length);
}
main().catch(e=>{console.error(e);process.exitCode=1});
