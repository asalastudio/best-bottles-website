const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve('output/family-hero-run');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f)));
const lineagePath=f=>f.includes('/output/')?'output/'+f.split('/output/')[1]:f.includes('/generated_images/')?'generated_images/'+f.split('/generated_images/')[1]:path.basename(f);
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
(async()=>{
 const review=JSON.parse(fs.readFileSync('public/preview/catalog-empty-heroes/manifest.json'));
 const votes=read('user-review-followup-20260906T052825Z.json');
 const held=new Map(votes.rows.filter(r=>r.vote==='revise'&&r.family!=='Atomizer').map(r=>[r.sku,'Marked for revision in product review']));
 const atomizers=new Map(read('atomizer-source-rollout-measurements.json').rows.map(r=>[r.sku,r]));
 const snapshot=read('integration-catalog-snapshot.json'),groups=new Map(snapshot.groups.map(g=>[g._id,g]));
 const records=[],lineage=[];
 fs.mkdirSync('public/images/catalog/empty-heroes',{recursive:true});
 for(const r of review.rows){
  const a=atomizers.get(r.sku);
  if(a&&!a.pass)held.set(r.sku,'Atomizer exceeds approved master width tolerance');
  if(held.has(r.sku))continue;
  const matches=snapshot.products.filter(p=>p.websiteSku===r.sku);
  if(matches.length!==1)throw Error('Expected one exact catalog SKU: '+r.sku+' found '+matches.length);
  const product=matches[0],group=groups.get(product.productGroupId);
  if(!group)throw Error('Missing group for '+r.sku);
  if(group.family!==r.family)throw Error('Family mismatch for '+r.sku+': '+group.family+' vs '+r.family);
  const original=a?.generatedOriginal||r.original,framing=a?.framing||r.framing;
  const sha=hash(original),name=r.sku+'.'+sha.slice(0,12)+'.webp',url='/images/catalog/empty-heroes/'+name;
  if(!fs.existsSync('public'+url))await sharp(original).resize(1560,1716,{fit:'contain',background:'#f5f3ef'}).webp({quality:92}).toFile('public'+url);
  const entry={groupSlug:group.slug,websiteSku:r.sku,graceSku:product.graceSku,shopifyVariantId:r.shopifyVariantId??null,family:r.family,capacityMl:r.capacityMl,bottleColor:product.color||r.color||null,url,alt:r.groupName+' — '+(a?'capped and uncovered Atomizer with loose cap':r.presentation),width:1560,height:1716,presentation:a?'Capped + uncovered + loose cap':r.presentation,framing};
  records.push(entry);lineage.push({...entry,source:lineagePath(r.source),generatedOriginal:lineagePath(original),originalSha256:sha,assetSha256:hash('public'+url),reviewedSlug:r.slug,groupReconciled:r.slug!==group.slug});
 }
 if(new Set(records.map(r=>r.websiteSku)).size!==records.length)throw Error('Duplicate hero SKU');
 fs.writeFileSync('src/lib/products/catalog-heroes.json',JSON.stringify(records,null,2)+'\n');
 const report={createdAt:new Date().toISOString(),count:records.length,groupCount:new Set(records.map(r=>r.groupSlug)).size,held:[...held].map(([sku,reason])=>({sku,reason})),mode:'Empty static heroes; exact SKU matching only',published:false,rows:lineage};
 fs.writeFileSync('docs/reviews/catalog-hero-integration.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({count:report.count,groups:report.groupCount,held:report.held,reconciledGroups:lineage.filter(r=>r.groupReconciled).map(r=>({sku:r.websiteSku,before:r.reviewedSlug,after:r.groupSlug}))},null,2));
})();
