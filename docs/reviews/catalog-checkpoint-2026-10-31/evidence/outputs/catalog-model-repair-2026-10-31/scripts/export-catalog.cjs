const fs=require('fs');
const {ConvexHttpClient}=require('convex/browser');
const client=new ConvexHttpClient('https://precise-raccoon-123.convex.cloud');
(async()=>{let cursor=null,rows=[];do{const p=await client.action('products:getProductExportPage',{cursor,numItems:250});rows.push(...p.page);cursor=p.isDone?null:p.continueCursor;console.log('Read catalog rows: '+rows.length);}while(cursor);fs.writeFileSync('outputs/catalog-model-repair-2026-10-31/sources/catalog-production.json',JSON.stringify({collectedAt:new Date().toISOString(),deployment:'precise-raccoon-123',readOnly:true,rows},null,2));})();
