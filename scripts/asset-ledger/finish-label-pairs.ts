import { readFileSync, writeFileSync } from "node:fs"; import path from "node:path";
import { getFinishFromWebsiteSku } from "../../src/lib/paper-doll/tokens.generated";
const root=process.cwd();
const diag=JSON.parse(readFileSync(path.join(root,"data/asset-ledger/finish-component-diag.json"),"utf8")).rows as any[];
const snap=JSON.parse(readFileSync(path.join(root,"data/asset-ledger/builder-catalog-snapshot.json"),"utf8")).rows as any[];
const bySku=new Map(snap.map((r:any)=>[r.sku,r]));
const pairs:Record<string,number>={}; const detail:any[]=[];
for(const d of diag){ if(!d.reason.startsWith("no listed")||!d.reason.includes("with finish"))continue;
 const row=bySku.get(d.sku); if(!row)continue; const listed=(row.components[d.kind]??[]) as any[];
 const labels=listed.map(p=>({sku:p.websiteSku,label:getFinishFromWebsiteSku(p.websiteSku)?.label??null})).filter(x=>x.sku&&x.sku.includes(d.neck));
 const key=`${d.kind} | row '${d.finish}' vs components [${[...new Set(labels.map(l=>l.label??"∅"))].sort().join(", ")}]`;
 pairs[key]=(pairs[key]??0)+1; detail.push({sku:d.sku,kind:d.kind,rowFinish:d.finish,components:labels}); }
writeFileSync(path.join(root,"data/asset-ledger/finish-label-pairs.json"),JSON.stringify(detail,null,1));
console.log("label-mismatch rows:",detail.length,"\n");
for(const [k,v] of Object.entries(pairs).sort((a,b)=>b[1]-a[1]).slice(0,28)) console.log(`  ${String(v).padStart(4)}  ${k}`);
