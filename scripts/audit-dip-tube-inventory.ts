/** Read-only data inventory. Does not request website pages or mutate either backend. */
import fs from 'node:fs';import path from 'node:path';import {ConvexHttpClient} from 'convex/browser';import {api} from '../convex/_generated/api';import {drawableRegisterKits} from '../src/lib/register/load';import {availableViews} from '../src/lib/products/pdp-redesign/stage';
const base='/Users/jordanrichter/Documents/Codex/2026-10-01/users-jordanrichter-projects-clients-nemat-international/outputs/media-completion-2026-10-12';
const out=base+'/dip-tube-audit-2026-10-13';fs.mkdirSync(out,{recursive:true});
async function main(){for(const env of ['production','development']){
 const snap=JSON.parse(fs.readFileSync(base+'/local-production-alignment-2026-10-13/'+env+'.json','utf8'));
 const c=new ConvexHttpClient('https://'+snap.source);const products=snap.products;
 const payload:any={assemblies:{},components:{},bodies:{},plates:{}},legacy:any={};const errors:any[]=[];
 const chunks:any[][]=[];for(let i=0;i<products.length;i+=50)chunks.push(products.slice(i,i+50));let next=0,done=0;
 await Promise.all(Array.from({length:3},async()=>{while(next<chunks.length){const ix=next++,chunk=chunks[ix];try{
 const r=await c.query(api.registerStage.forSkus,{graceSkus:chunk.map((p:any)=>p.graceSku).filter(Boolean)});
 for(const k of Object.keys(payload))Object.assign(payload[k],r[k as keyof typeof r]);
 // Legacy paths matter for unresolved register assemblies as well as image fallback.
 const pairs=chunk.filter((p:any)=>/spray|pump|dropper/i.test(p.applicator??'')||/spray|pump|dropper/i.test(p.itemName??'')).map((p:any)=>({graceSku:p.graceSku??null,websiteSku:p.websiteSku??null}));
 if(pairs.length)Object.assign(legacy,await c.query(api.productKits.forSkus,{pairs}));
 }catch(e){errors.push({chunk:ix,error:String(e)});}done++;if(done%15===0)console.log(env,done+'/'+chunks.length);}}));
 Object.assign(process.env,{NODE_ENV:'development'});const kits=drawableRegisterKits(payload);
 const rows=products.filter((p:any)=>/spray|pump|dropper/i.test(p.applicator??'')||/spray|pump|dropper/i.test(p.itemName??'')).map((p:any)=>{
 const registered=kits[p.graceSku],old=legacy[p.websiteSku]??legacy[p.graceSku],kit=registered??old;
 const parts=kit?.parts??[];return {websiteSku:p.websiteSku,graceSku:p.graceSku,family:p.family,capacityMl:p.capacityMl,glass:p.color,fitment:p.applicator,stockStatus:p.stockStatus,
 imagePath:registered?'register':old?'legacy-kit':p.imageUrl?'flat-photo':'missing',tubeParts:parts.filter((x:any)=>['diptube','pipette'].includes(x.slot)).map((x:any)=>({slot:x.slot,url:x.image?.url,componentId:x.componentId,views:x.views??null,box:x.box??null})),
 supportedViews:kit?availableViews(kit,p):[],registerReason:payload.assemblies[p.graceSku]?.reason??null,visualReview:'pending',browserVerified:false};});
 fs.writeFileSync(path.join(out,env+'-register.json'),JSON.stringify(payload));fs.writeFileSync(path.join(out,env+'-legacy.json'),JSON.stringify(legacy));fs.writeFileSync(path.join(out,env+'-inventory.json'),JSON.stringify({collectedAt:new Date().toISOString(),source:snap.source,products:products.length,rows,errors},null,2));
 console.log(env,JSON.stringify({records:rows.length,withTubeParts:rows.filter((r:any)=>r.tubeParts.length).length,withoutSeparateTube:rows.filter((r:any)=>!r.tubeParts.length).length,errors:errors.length}));
}}
main();
