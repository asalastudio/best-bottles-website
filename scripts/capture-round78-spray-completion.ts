import fs from 'node:fs';import {config} from 'dotenv';import {ConvexHttpClient} from 'convex/browser';import {api} from '../convex/_generated/api';
config({path:'.env.local',quiet:true});
const out='output/round78-spray-completion';
async function main(){
 for(const env of ['production','development']){
 const url=env==='development'?process.env.NEXT_PUBLIC_CONVEX_URL!:'https://'+JSON.parse(fs.readFileSync('output/pdp-readiness-20261019/catalog-refresh/production.json','utf8')).source;
 const c=new ConvexHttpClient(url);const matrix=await c.query(api.matrix.getFamilyRows,{family:'Round'});
 const groups=await Promise.all(['round-78ml-clear-18-415-perfumespray','round-78ml-frosted-18-415-perfumespray'].map(slug=>c.query(api.products.getProductGroup,{slug})));
 const variants=groups.flatMap(g=>g?.variants??[]);const register=await c.query(api.registerStage.forSkus,{graceSkus:variants.map(v=>v.graceSku!).filter(Boolean)});
 fs.writeFileSync(`${out}/${env}-snapshot.json`,JSON.stringify({environment:env,capturedAt:new Date().toISOString(),matrix,groups,register},null,2));console.log(env,variants.length,'spray variants captured read-only');
 }
}main();
