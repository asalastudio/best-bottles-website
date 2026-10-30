/** Offline review only: use storefront placement code with isolated PSD extractions.
 * No catalogue writes, asset publication, or approval flags are changed.
 * Usage: npx tsx scripts/review-boston15-source-assemblies.ts OUTPUT_DIRECTORY
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { kitFromRegister, type RegisterStagePayload, type RegisterComponent } from '../src/lib/register/stage-kit';

async function main() {
 const out=process.argv[2]; if(!out) throw new Error('Output directory required');
 const read=(file:string)=>JSON.parse(fs.readFileSync(path.join(out,file),'utf8'));
 const plan=read('boston15-source-plan.json');
 const measurements=read('boston15-measurements.json');
 const saved=JSON.parse(fs.readFileSync(path.join(out,'../evidence/precise-raccoon-123-register-stage.json'),'utf8'));
 const dest=path.join(out,'source-assemblies');fs.mkdirSync(dest,{recursive:true});
 const slug:Record<string,string>={'Amber':'amber','Clear':'clear','Cobalt Blue':'cobalt-blue'};
 const payload:RegisterStagePayload={plates:{},components:{},assemblies:{},bodies:{}};
 for(const [key,value] of Object.entries(saved.plates)) {
  if(!key.startsWith('boston-round-15ml-18-400|')) continue;
  const p=value as RegisterStagePayload['plates'][string];
  payload.plates[key]={...p,url:path.join(out,'approved-bodies',`${slug[p.glass]}.png`)};
 }
 for(const c of measurements.components) payload.components[c.componentId]={
  componentId:c.componentId,type:c.type,approved:false,
  layers:c.layers.map((l:Record<string,unknown>)=>({...l,url:path.join(out,'boston15-parts',String(l.file)),approved:false})),
 } as RegisterComponent;
 const rows=[];
 for(const [sku,value] of Object.entries(plan.assemblies)) {
  const a=value as {bodyId:string;glass:string;role:string;componentId:string;catalogueState:string;catalogueCorrectionPending:boolean};
  const plateKey=`${a.bodyId}|${a.glass}`;
  // renderable is a local construction flag only; source layers remain unapproved.
  payload.assemblies[sku]={graceSku:sku,websiteSku:sku,bodyId:a.bodyId,plateKey,glass:a.glass,neck:'18-400',parts:[{role:a.role,componentId:a.componentId}],renderable:true,reason:'isolated source review only'};
  const kit=kitFromRegister(sku,payload);if(!kit) throw new Error(`No local composition: ${sku}`);
  const images=kit.parts.filter(p=>!p.views||p.views.includes('capon')).sort((a,b)=>a.zOrder-b.zOrder).map(p=>{
   const b=p.box;const data=fs.readFileSync(p.image.url).toString('base64');
   return `<image x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" href="data:image/png;base64,${data}"/>`;
  }).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1100"><rect width="1000" height="1100" fill="#f5f3ef"/>${images}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(dest,`${sku}.png`));
  rows.push({websiteSku:sku,glass:a.glass,componentId:a.componentId,recordedCatalogueState:a.catalogueState,catalogueCorrectionPending:a.catalogueCorrectionPending,parts:kit.parts,stageAnchors:kit.anchors,browserVerified:false,visuallyApproved:false,release:'held'});
 }
 fs.writeFileSync(path.join(dest,'assemblies.json'),JSON.stringify(rows,null,2)+'\n');
 const tiles=await Promise.all(rows.map(async(r,i)=>({input:await sharp(path.join(dest,`${r.websiteSku}.png`)).resize(250,275).extend({top:30,bottom:15,left:0,right:0,background:'#f5f3ef'}).composite([{input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="250" height="30"><text x="8" y="18" font-size="9" fill="#222">${r.websiteSku}</text></svg>`),top:0,left:0}]).png().toBuffer(),left:(i%7)*250,top:Math.floor(i/7)*320})));
 await sharp({create:{width:1750,height:960,channels:3,background:'#f5f3ef'}}).composite(tiles).jpeg({quality:95}).toFile(path.join(dest,'contact-sheet.jpg'));
 console.log(`Saved ${rows.length} offline source assemblies. No browser or visual acceptance claimed.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
