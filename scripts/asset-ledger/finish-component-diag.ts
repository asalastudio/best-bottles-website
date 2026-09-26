import { readFileSync, existsSync, writeFileSync } from "node:fs"; import path from "node:path";
import { ConvexHttpClient } from "convex/browser"; import { api } from "../../convex/_generated/api";
import { getFinishFromWebsiteSku } from "../../src/lib/paper-doll/tokens.generated";
import { exactComponentMatch } from "../../src/lib/bottle-builder/component-matches";
import { sourceComponentLink, sourceComponentLinks } from "../../src/lib/bottle-builder/source-component-links";
const root=process.cwd(); if(!process.env.NEXT_PUBLIC_CONVEX_URL&&existsSync(path.join(root,".env.local"))) for(const l of readFileSync(path.join(root,".env.local"),"utf8").split("\n")){const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]])process.env[m[1]]=m[2];}
const convex=new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const funnel=JSON.parse(readFileSync(path.join(root,"data/asset-ledger/builder-funnel.json"),"utf8"));
const targets=new Set<string>(); for(const [,dr] of Object.entries<Record<string,string[]>>(funnel.drops)) for(const [k,v] of Object.entries(dr)) if(k.includes("finish component")) v.forEach(s=>targets.add(s));
(async()=>{ const fams=(await convex.query(api.matrix.listFamilies,{})).map((f:any)=>f.family); const out:any[]=[]; const why:Record<string,number>={};
for(const family of fams){ const d=await convex.query(api.matrix.getFamilyRows,{family}); for(const row of d.rows as any[]){ if(!targets.has(row.websiteSku))continue;
 const source=sourceComponentLink(row); const exact=exactComponentMatch(row.websiteSku??"")??source;
 const app=row.applicator??""; const kind=/roller/i.test(app)?"Roll-On Cap":/pump/i.test(app)&&!/spray/i.test(app)?"Lotion Pump":/spray/i.test(app)?"Sprayer":/dropper/i.test(app)?"Dropper":"Cap";
 const pat=kind==="Sprayer"?(/tassel/i.test(app)?/^(AnSpTsl|CP\d+-\d+AnSpTsl)/i:/vintage|bulb/i.test(app)?/^(AnSp(?!Tsl)|CP\d+-\d+AnSp(?!Tsl))/i:/^(Spry|CP\d+-\d+Spry)/i):kind==="Roll-On Cap"?/^CPRoll/i:kind==="Lotion Pump"?/^Ltn/i:kind==="Dropper"?/^Drp/i:/^CP(?!Roll|.*(?:Spry|AnSp))/i;
 const finish=getFinishFromWebsiteSku(row.websiteSku)?.label??row.capColor?.trim();
 const listed=(row.components[kind]??[]) as any[]; const steps={listedOfKind:listed.length,withIds:0,notRetiredInStock:0,patternOk:0,neckOk:0,finishOk:0};
 for(const p of listed){ if(!(p.websiteSku&&p.graceSku))continue; steps.withIds++; if(/__RETIRED__/i.test(p.websiteSku)||/out of stock|discontinued|unavailable/i.test(p.stockStatus??""))continue; steps.notRetiredInStock++; if(!pat.test(p.websiteSku))continue; steps.patternOk++; if(!p.websiteSku.includes(row.neckThreadSize??"invalid"))continue; steps.neckOk++; const ok=exact?p.websiteSku===exact.componentSku:getFinishFromWebsiteSku(p.websiteSku)?.label===finish; if(ok)steps.finishOk++; }
 let reason:string; if(!finish&&!exact)reason="row has no finish label (SKU token + capColor both empty)"; else if(exact&&(row.family!==exact.family||row.capacityMl!==exact.capacityMl||row.color!==exact.color||row.neckThreadSize!==exact.neck||(row.applicator??null)!==exact.applicator))reason="exact-match table disagrees with row identity"; else if(!source&&sourceComponentLinks.some((l:any)=>l.assemblySku===row.websiteSku))reason="source link missing for a linked assembly"; else if(steps.listedOfKind===0)reason=`no ${kind} listed on the row`; else if(steps.notRetiredInStock===0)reason=`all listed ${kind} retired/out of stock`; else if(steps.patternOk===0)reason=`listed ${kind} SKUs do not match the ${kind} pattern`; else if(steps.neckOk===0)reason=`listed ${kind} SKUs do not carry neck ${row.neckThreadSize}`; else if(steps.finishOk===0)reason=`no listed ${kind} with finish '${finish}'`; else if(steps.finishOk>1)reason=`ambiguous: ${steps.finishOk} listed ${kind} match finish '${finish}'`; else reason="unexplained";
 why[reason]=(why[reason]??0)+1; out.push({sku:row.websiteSku,family,applicator:app,kind,finish,neck:row.neckThreadSize,reason,steps}); } }
writeFileSync(path.join(root,"data/asset-ledger/finish-component-diag.json"),JSON.stringify({generatedAt:new Date().toISOString(),rows:out},null,1));
console.log("finish-component failures diagnosed:",out.length); for(const [k,v] of Object.entries(why).sort((a,b)=>b[1]-a[1]))console.log(`  ${String(v).padStart(5)}  ${k}`);
const byFamKind:Record<string,number>={}; for(const r of out) byFamKind[`${r.family} / ${r.kind}`]=(byFamKind[`${r.family} / ${r.kind}`]??0)+1; console.log("\n  by family/kind:",Object.entries(byFamKind).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k,v])=>`${k} ${v}`).join(" | "));
})();
