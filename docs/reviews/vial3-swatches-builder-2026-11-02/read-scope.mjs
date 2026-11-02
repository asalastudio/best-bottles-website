import fs from 'node:fs';
import {ConvexHttpClient} from 'convex/browser';
import {anyApi} from 'convex/server';
const dir='docs/reviews/vial3-swatches-builder-2026-11-02';
const env={...process.env};
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){
 const match=line.match(/^([A-Z0-9_]+)=(.*)$/);if(match)env[match[1]]??=match[2].trim().replace(/^["']|["']$/g,'');
}
const client=new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
const skus=['GBVGreen2o4BlackCapSht','GBVGreen2o4WhtCapSht','GBVBlu1o9BlackCapSht'];
const groups=await Promise.all(['vial-3ml-green-13-425','vial-3ml-blue-13-425'].map(slug=>client.query(anyApi.products.getProductGroup,{slug})));
const matrix=await client.query(anyApi.matrix.getFamilyRows,{family:'Vial'});
const rows=matrix.rows.filter(row=>skus.includes(row.websiteSku));
if(rows.length!==3||matrix.truncated)throw Error('Vial source scope changed');
fs.writeFileSync(dir+'/catalog-snapshot.json',JSON.stringify({capturedAt:new Date().toISOString(),environment:new URL(env.NEXT_PUBLIC_CONVEX_URL).hostname,groups,rows},null,2)+'\n');
console.log(JSON.stringify({groups:groups.length,rows:rows.length,readOnly:true}));
