/** Owner request: restore the short 2 ml / 13-425 amber vial's black-cap option.
 * Keeps the known PSD/legacy website SKU as its identifier until a canonical
 * Grace/Shopify mapping is assigned. Never borrows the white variant's cart GID.
 * Default: read-only plan. --apply creates only this missing exact variant.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ConvexHttpClient} from 'convex/browser';
import {anyApi} from 'convex/server';
const env={...process.env};
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){
 const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]??=m[2].trim().replace(/^["']|["']$/g,'');
}
const slug='vial-2ml-amber-13-425',websiteSku='GBVAmb1o5BlackCapSht',twinWebsiteSku='GBVialAmb1o5WhtCapSht';
const dir='docs/reviews/vial2-short-black-2026-11-02';fs.mkdirSync(dir,{recursive:true});
const client=new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
const group=await client.query(anyApi.products.getProductGroup,{slug});assert(group);
const twin=group.variants.find(v=>v.websiteSku===twinWebsiteSku);assert(twin);
assert.equal(twin.family,'Vial');assert.equal(twin.capacityMl,2);assert.equal(twin.neckThreadSize,'13-425');assert.equal(twin.color,'Amber');
assert.equal(twin.heightWithoutCap,'22 ±0.5 mm');assert.equal(twin.diameter,'16 ±0.5 mm');
const existing=await client.query(anyApi.products.lookupSku,{sku:websiteSku});
const imageUrl='https://www.bestbottles.com/images/store/enlarged_pics/GBVAmb1o5BlackCapSht.gif';
const response=await fetch(imageUrl);assert(response.ok);assert(response.headers.get('content-type')?.startsWith('image/'));
const itemDescription='Amber glass sample vial with a short black screw cap, 13-425 neck. Bottle size: 0.08 oz. For perfume, fragrance oil and essential oil.';
const plan={websiteSku,graceSku:websiteSku,twinWebsiteSku,groupSlug:slug,color:'Amber',capColor:'Black',
 itemName:'2 ml Amber Vial with Short Black Cap',itemDescription,
 priceTiers:[{minQty:1,unitPrice:.38,totalPrice:.38}],
 source:'2026-11-02 owner request. Exact GBVAmb1o5BlackCapSht PSD and legacy image identify the short 13-425 bottle. The historical black vial import records $0.38 each. Legacy website identifier retained until canonical Grace/Shopify mapping; quote-only.',
 imageUrl,checkoutPolicy:'New variant has no Shopify linkage and stays quote-only. White checkout identifiers are never copied.',
 alreadyPresent:Boolean(existing),environment:new URL(env.NEXT_PUBLIC_CONVEX_URL).hostname};
fs.writeFileSync(dir+'/restore-plan.json',JSON.stringify(plan,null,2)+'\n');
if(!process.argv.includes('--apply')){console.log(JSON.stringify({dryRun:true,websiteSku,alreadyPresent:plan.alreadyPresent,quoteOnly:true}));process.exit(0);}
assert(env.BEST_BOTTLES_CONVEX_WRITE_TOKEN,'Missing catalog write credential');
if(existing){assert.equal(existing.slug,slug);assert.equal(existing.product.capColor,'Black');}
else{
 const result=await client.mutation(anyApi.products.createProductFromTwin,{writeToken:env.BEST_BOTTLES_CONVEX_WRITE_TOKEN,
  twinWebsiteSku,websiteSku,graceSku:websiteSku,groupSlug:slug,color:'Amber',capColor:'Black',
  itemName:plan.itemName,itemDescription,priceTiers:plan.priceTiers,source:plan.source});
 assert(result.created,result.detail);
}
const imageResult=await client.mutation(anyApi.products.setVariantImages,{websiteSku,imageUrl,imageUrlCapOff:imageUrl,writeToken:env.BEST_BOTTLES_CONVEX_WRITE_TOKEN});assert(imageResult.success);
const after=await client.query(anyApi.products.getProductGroup,{slug});
const black=after.variants.find(v=>v.websiteSku===websiteSku);assert(black);assert.equal(black.shopifyVariantId,null);assert.equal(black.shopifySellable,false);
assert.equal(black.capacityMl,twin.capacityMl);assert.equal(black.neckThreadSize,twin.neckThreadSize);
assert.equal(black.heightWithoutCap,twin.heightWithoutCap);assert.equal(black.diameter,twin.diameter);assert.equal(black.imageUrl,imageUrl);
const white=after.variants.find(v=>v.websiteSku===twinWebsiteSku);assert.deepEqual(white,twin,'White variant changed');
const result={written:!existing,websiteSku,groupSlug:slug,variantId:black._id,caps:after.variants.map(v=>v.capColor),
 physicalTwinPreserved:true,whiteVariantUnchanged:true,quoteOnly:true,shopifyVariantId:black.shopifyVariantId,imageUrl};
fs.writeFileSync(dir+'/restore-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
