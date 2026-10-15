/** Exact SKU/finish checks against the saved snapshot; no browser or cart writes. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { drawableRegisterKits } from '../src/lib/register/load';
import { closureParts } from '../src/lib/products/pdp-redesign/stage';
import { capOptions, picksOf, resolveVariant, pickQuery, rollerOptions } from '../src/lib/products/pdp-redesign/model';
import { isClosurePart } from '../src/lib/bottle-builder/model';
import assets from '../src/lib/register/local-tassel-assets.json';

const root=process.argv[2]; assert(root);
const read=(name:string)=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const proof=read('verification.json'),products=read('products.json');
const matrix:any[]=Object.values(read('matrix-families.json')).flatMap((f:any)=>f.rows);
Object.assign(process.env,{NODE_ENV:'development'});
const kits=drawableRegisterKits(read('register-stage.json'));
const results=proof.rows.map((row:any)=>{
    const groupRows=matrix.filter(r=>r.productGroupSlug===row.productGroupSlug);
    const variants=groupRows.map(r=>products.find((p:any)=>p.graceSku===r.graceSku)).filter(Boolean);
    const product=variants.find((p:any)=>p.websiteSku===row.websiteSku);assert(product);
    const options=capOptions(variants,null),picks=picksOf(product,options),selected=resolveVariant(variants,picks);
    assert.equal(selected?.websiteSku,row.websiteSku,`Ambiguous PDP selection: ${row.websiteSku}`);
    const kit=kits[row.graceSku],asset=assets.find(a=>a.componentId===row.componentId) ?? {url:row.asset};
    assert(closureParts(kit).some(p=>p.image.url===asset.url));
    const finishParts=kit.parts.filter(p=>p.slot!=='body'&&p.slot!=='diptube'&&!isClosurePart(p));
    assert(finishParts.some(p=>p.image.url===asset.url));
    return {websiteSku:row.websiteSku,graceSku:row.graceSku,finish:row.finish,
        pdpUrl:`http://localhost:3005/products/${row.productGroupSlug}?${pickQuery(picks,rollerOptions(variants))}`,
        pdpSelectionIdentity:true,pdpClosureThumbnailCorrect:true,builderFinishThumbnailCorrect:true,
        browserVerified:false,cartUiVerified:false};
});
fs.writeFileSync(path.join(root,'selection-verification.json'),JSON.stringify({createdAt:new Date().toISOString(),method:'Pure shared selector/thumbnail functions against saved catalogue. No browser or cart mutation.',rows:results},null,2)+'\n');
console.log(JSON.stringify({exactPdpSelections:results.length,pdpThumbnailMappings:results.length,builderThumbnailMappings:results.length,browserVerified:false}));
