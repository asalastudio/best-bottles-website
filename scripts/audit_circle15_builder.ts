/** Read-only: run with npx tsx scripts/audit_circle15_builder.ts while localhost:3001 is running. */
import fs from 'node:fs';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import { resolveListedComponents } from '../src/lib/bottle-builder/components';
import { assessBuilderConfiguration } from '../src/lib/bottle-builder/model';
async function main(){
 const url=fs.readFileSync('.env.local','utf8').match(/^NEXT_PUBLIC_CONVEX_URL=["']?([^\s"']+)/m)![1]; const client=new ConvexHttpClient(url);
 const data=await client.query(api.matrix.getFamilyRows,{family:'Circle'});
 const rows=await resolveListedComponents(data.rows.filter((r:any)=>r.capacityMl===15&&r.applicator==='Fine Mist Sprayer'),async sku=>(await client.query(api.products.lookupSku,{sku}))?.product??null);
 const results=[];
 for(const row of rows){
  const {configuration:c,issue}=assessBuilderConfiguration(row);
  if(!c) throw new Error(row.websiteSku+': '+issue);
  const payload={family:'Circle',sku:c.id,selection:{bodyId:c.bodyId,color:c.color,fitment:c.fitment,closure:c.closure,quantity:100}};
  const response=await fetch('http://localhost:3001/api/bottle-builder/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const body=await response.json();
  if(!response.ok||body.configuration?.id!==c.id||body.configuration?.product.shopifyVariantId!==c.product.shopifyVariantId||body.configuration?.finishComponent.websiteSku!==c.finishComponent.websiteSku)throw new Error(c.id+': '+JSON.stringify(body));
  results.push({sku:c.id,finish:c.closure,component:body.configuration.finishComponent.websiteSku,variant:c.product.shopifyVariantId,status:response.status,photo:c.photoUrl});
 }
 fs.writeFileSync('docs/reviews/circle15-preflight-results.json',JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));console.log(JSON.stringify(results,null,2));
 if(results.length!==8)throw new Error('Expected eight spray finishes');
}
main();
