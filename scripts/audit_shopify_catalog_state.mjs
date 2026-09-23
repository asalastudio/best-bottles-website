#!/usr/bin/env node
/** Read-only whole-store inventory and exact catalog identity audit. --out is required. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {ConvexHttpClient} from 'convex/browser';
import {api} from '../convex/_generated/api.js';
const outIndex=process.argv.indexOf('--out');
if(outIndex<0||!process.argv[outIndex+1])throw Error('--out directory is required');
const outDir=resolve(process.argv[outIndex+1]);mkdirSync(outDir,{recursive:true});
if(!process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN||!process.env.SHOPIFY_ADMIN_TOKEN)throw Error('Provide Shopify domain and admin token through environment');
const domain=process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN.replace(/^https?:\/\//,'').replace(/\/$/,'');
if(domain!=='bestbottles-1580.myshopify.com')throw Error('Unexpected store');
const target='https://precise-raccoon-123.convex.cloud';
const operations=readFileSync(new URL('./shopify/catalog-state.graphql',import.meta.url),'utf8');
async function gql(operationName,variables={}){
 for(let i=0;i<5;i++){
  const r=await fetch(`https://${domain}/admin/api/2026-07/graphql.json`,{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':process.env.SHOPIFY_ADMIN_TOKEN},body:JSON.stringify({query:operations,operationName,variables})});
  const b=await r.json();
  if(r.status===429 || b.errors?.some(e=>e.extensions?.code==='THROTTLED')){await new Promise(r=>setTimeout(r,2000));continue;}
  if(!r.ok||b.errors)throw Error(JSON.stringify({status:r.status,errors:b.errors}));
  return b.data;
 }
 throw Error('Throttle retries exhausted');
}
const identity=await gql('ShopIdentity');
const products=[],variants=[];
for(const [name,key,out] of [['AllProducts','products',products],['AllVariants','productVariants',variants]]){
 let cursor=null;
 do{const r=(await gql(name,{cursor}))[key];out.push(...r.nodes);cursor=r.pageInfo.hasNextPage?r.pageInfo.endCursor:null;console.log(key,out.length);}while(cursor);
}
const client=new ConvexHttpClient(target),website=[];
let cursor=null;
for(;;){const r=await client.action(api.products.getProductExportPage,{cursor,numItems:500});website.push(...r.page);if(r.isDone)break;cursor=r.continueCursor;}
const gid=x=>x?(String(x).startsWith('gid://')?String(x):`gid://shopify/ProductVariant/${x}`):null;
const report=products.map(p=>{
 const siblings=variants.filter(v=>v.product.id===p.id).map(v=>{
  const matches=website.filter(w=>[w.graceSku,w.websiteSku].includes(v.sku)&&gid(w.shopifyVariantId)===v.id);
  return {...v,matches:matches.map(w=>({graceSku:w.graceSku,websiteSku:w.websiteSku,stockStatus:w.stockStatus,shopifySellable:w.shopifySellable,group:w.productGroupId,category:w.category,itemName:w.itemName})),blockers:!v.sku?['BLANK_SKU']:matches.length!==1?['NO_UNIQUE_EXACT_SKU_VARIANT_MATCH']:matches[0].websiteSku?.includes('__RETIRED__')||matches[0].stockStatus==='Discontinued'?['RETIRED_RECORD']:[]};
 });
 return {...p,variants:siblings,identitySafe:siblings.length>0&&siblings.every(v=>v.blockers.length===0)};
});
const by=(xs,key)=>xs.reduce((a,x)=>(a[key(x)]=(a[key(x)]||0)+1,a),{});
const real=website.filter(w=>!String(w.graceSku).includes('TEST'));
const summary={checkedAt:new Date().toISOString(),target,domain,identity,products:products.length,variants:variants.length,status:by(products,p=>p.status),unpublished:products.filter(p=>!p.publishedAt).length,notAvailable:variants.filter(v=>!v.availableForSale).length,tracked:variants.filter(v=>v.inventoryItem.tracked).length,identitySafeParents:report.filter(p=>p.identitySafe).length,heldParents:report.filter(p=>!p.identitySafe).map(p=>({id:p.id,title:p.title,status:p.status,problemVariants:p.variants.filter(v=>v.blockers.length)})),websiteRows:website.length,websiteStockLabels:by(real,w=>w.stockStatus),websiteSellability:by(real,w=>String(w.shopifySellable)),websiteNoVariant:real.filter(w=>!w.shopifyVariantId).map(w=>({graceSku:w.graceSku,websiteSku:w.websiteSku,itemName:w.itemName,stockStatus:w.stockStatus}))};
writeFileSync(resolve(outDir,'full-audit.json'),JSON.stringify({summary,products,variants,website,report},null,2));
writeFileSync(resolve(outDir,'summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({checkedAt:summary.checkedAt,products:summary.products,variants:summary.variants,status:summary.status,tracked:summary.tracked,notAvailable:summary.notAvailable,heldParents:summary.heldParents.length,websiteStockLabels:summary.websiteStockLabels},null,2));
