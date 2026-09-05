// Copy approved review assets into the catalog using lossless WebP; retain exact review transforms.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sourceRoot = process.argv[2];
if (!sourceRoot) throw new Error('Pass the checkout containing the approved review pages');
const sharp = require(require.resolve('sharp', { paths: [sourceRoot] }));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const previous = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'src/lib/products/cylinder-catalog-heroes.json')));
const approved = new Map();
for (const name of ['cylinder-hover-approved-2026-09-05.json', ...[1,2,3,4,5].map(n=>`cylinder-hover-batch-0${n}.lock.json`)]) {
  const lock = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'docs/reviews', name)));
  for (const row of lock.files) for (const f of row.images ?? [row]) approved.set(f.path, f.sha256);
}
const pairs = new Map();
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
for (const folder of ['cylinder-hover', ...[1,2,3,4,5].map(n=>`cylinder-hover-batch-0${n}`)]) {
  const html = fs.readFileSync(path.join(sourceRoot, 'public/preview', folder, 'index.html'), 'utf8');
  for (const article of html.matchAll(/<article\b[^>]*>(.*?)<\/article>/gs)) {
    const sku = article[1].match(/<small[^>]*>(.*?)<\/small>/s)?.[1];
    const images = [...article[1].matchAll(/<img\b[^>]*>/g)].map(x=>x[0]);
    if (!sku || images.length !== 2 || pairs.has(sku)) throw new Error('Invalid/duplicate review pair '+sku);
    pairs.set(sku, images.map(tag=>{
      const style = attr(tag,'style') ?? '';
      const t = style.match(/translate\(([-\d.]+)%,\s*([-\d.]+)%\)\s*scale\(([-\d.]+)\)/);
      if (style && !t) throw new Error('Unrecognized approved transform '+style);
      return {path:`public/preview/${folder}/${attr(tag,'src').split('?')[0]}`,transform:{scale:t?Number(t[3]):1,translateXPercent:t?Number(t[1]):0,translateYPercent:t?Number(t[2]):0}};
    }));
  }
}
(async()=>{
  if (pairs.size!==52 || previous.length!==52) throw new Error('Cylinder coverage changed');
  fs.mkdirSync('public/images/catalog/cylinder-hover',{recursive:true});
  fs.mkdirSync('docs/reviews',{recursive:true});
  const rows=[],lineage=[];
  for(const old of previous){
    const pair=pairs.get(old.websiteSku);if(!pair)throw new Error('Missing '+old.websiteSku);
    const states=[];
    for(let i=0;i<2;i++){
      const input=fs.readFileSync(path.join(sourceRoot,pair[i].path));
      if(sha(input)!==approved.get(pair[i].path))throw new Error('Unapproved bytes '+pair[i].path);
      const meta=await sharp(input).metadata();if(meta.width!==2080||meta.height!==2288)throw new Error('Dimensions');
      const encoded=await sharp(input).webp({lossless:true,effort:5}).toBuffer();
      const originalPixels=await sharp(input).ensureAlpha().raw().toBuffer();
      const shippedPixels=await sharp(encoded).ensureAlpha().raw().toBuffer();
      if(!originalPixels.equals(shippedPixels))throw new Error('Lossless verification failed');
      const hash=sha(encoded),state=i?'filled':'empty';
      const url=`/images/catalog/cylinder-hover/${old.groupSlug}-${state}.${hash.slice(0,12)}.webp`;
      fs.writeFileSync('public'+url,encoded);
      states.push({url,transform:pair[i].transform,source:pair[i].path,sourceSha256:sha(input),sha256:hash,pixelSha256:sha(shippedPixels),bytes:encoded.length});
    }
    rows.push({groupSlug:old.groupSlug,websiteSku:old.websiteSku,graceSku:old.graceSku,shopifyVariantId:old.shopifyVariantId,url:states[0].url,hoverUrl:states[1].url,alt:old.alt,width:2080,height:2288,bottleColor:old.bottleColor,presentation:'approved-pair',framing:states[0].transform,hoverFraming:states[1].transform,interaction:/AnSp|^Pb/.test(old.websiteSku)?'fill-only':'cap-off-to-capped-full'});
    lineage.push({groupSlug:old.groupSlug,websiteSku:old.websiteSku,states});
  }
  fs.writeFileSync('src/lib/products/cylinder-catalog-heroes.json',JSON.stringify(rows,null,2)+'\n');
  fs.writeFileSync('docs/reviews/cylinder-hover-ui-lineage-2026-09-05.json',JSON.stringify({approvedBy:'Jordan Richter',approvedPairs:52,assetCount:104,productionPublished:false,encoding:'Lossless WebP. All decoded RGBA pixels equal approved PNGs. Review transforms preserved.',rows:lineage},null,2)+'\n');
  console.log(`52 pairs, 104 lossless assets; ${Math.round(lineage.flatMap(x=>x.states).reduce((s,x)=>s+x.bytes,0)/1024/1024)} MiB`);
})();
