/** Read-only source and exact-selection audit for the current local media batch. */
import fs from 'node:fs';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import { capOptions, derivePicks, resolveVariant, pickQuery } from '../src/lib/products/pdp-redesign/model';
const out='output/pdp-readiness-20261019';
const links=JSON.parse(fs.readFileSync('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/Best-Bottles-Website-02-20-2026-preservation/claude-browser-checks-2026-10-18/pr369-review-links.json','utf8')) as string[][];
const client=new ConvexHttpClient('https://precise-raccoon-123.convex.cloud');
async function main(){
 const file=out+'/product-groups.json';
 const groups=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):[];
 if(!groups.length){for(const slug of [...new Set(links.map(([l])=>l.split('?')[0].split('/products/')[1]))])groups.push(await client.query(api.products.getProductGroup,{slug}));fs.writeFileSync(file,JSON.stringify(groups));}
 const results=groups.flatMap((g:any)=>g.variants.map((v:any)=>{
  const picks=derivePicks(g.variants,g.group,{sku:v.websiteSku});
  const resolved=resolveVariant(g.variants,picks);
  const q=new URLSearchParams(pickQuery(picks,[]));
  const roundtrip=resolveVariant(g.variants,derivePicks(g.variants,g.group,{cap:q.get('cap')}));
  return {group:g.group.slug,sku:v.websiteSku,selectedSku:resolved?.websiteSku,sharedUrlSku:roundtrip?.websiteSku,cap:picks.cap,pass:resolved?.websiteSku===v.websiteSku&&roundtrip?.websiteSku===v.websiteSku};
 }));
 const report={checkedAt:new Date().toISOString(),source:'production group data; current local selection model',groups:groups.length,variants:results.length,failures:results.filter((r:any)=>!r.pass),results};
 fs.writeFileSync(out+'/selection-model.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({groups:report.groups,variants:report.variants,failures:report.failures},null,2));
}
main();
