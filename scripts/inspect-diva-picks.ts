import fs from 'node:fs';
import {ConvexHttpClient} from 'convex/browser';
import {api} from '../convex/_generated/api';
import {capOptions,capFinishName,derivePicks,resolveVariant} from '../src/lib/products/pdp-redesign/model';
async function main(){const client=new ConvexHttpClient('https://helpful-elephant-638.convex.cloud');const rows=[];
for(const fitment of ['antiquespray-tassel','antiquespray']){const g=await client.query(api.products.getProductGroup,{slug:`diva-46ml-clear-18-415-${fitment}`});if(!g)throw Error('missing group');rows.push(g);
console.log(JSON.stringify({group:g.group.slug,variants:g.variants.filter(v=>/Ivy|Rng/i.test(v.websiteSku)).map(v=>({sku:v.websiteSku,cap:v.capColor,style:v.capStyle,height:v.capHeight,name:v.itemName,description:v.itemDescription,finish:capFinishName(v as any),resolved:resolveVariant(g.variants as any,derivePicks(g.variants as any,g.group as any,{sku:v.websiteSku}))?.websiteSku})),options:capOptions(g.variants as any,null).map(o=>({id:o.id,skus:o.variants.map(v=>v.websiteSku)}))},null,2));}
fs.writeFileSync('output/pdp-readiness-20261019/diva-dev-groups.json',JSON.stringify(rows));}
main();
