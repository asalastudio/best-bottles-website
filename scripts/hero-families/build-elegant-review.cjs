// Build review-only derivatives from completed native renders. Never publishes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve('output/imagegen/elegant-2026-09-23');
const manifest=JSON.parse(fs.readFileSync(path.join(root,fs.existsSync(path.join(root,'active-manifest.json'))?'active-manifest.json':'manifest.json')));
const aligned=process.argv.includes('--aligned');
const exportsBySku=aligned?new Map(JSON.parse(fs.readFileSync(path.join(root,'aligned-exports.json'))).rows.map(r=>[r.sku,r])):new Map();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{
 const rows=[];
 for(const r of manifest.rows){
  const recordPath=r.rawOutput.replace(/\.png$/,'.render.json');
  if(!fs.existsSync(recordPath))continue;
  const record=JSON.parse(fs.readFileSync(recordPath));
  if(record.outputSha256!==hash(r.rawOutput))throw Error('Changed output '+r.sku);
  const meta=await sharp(r.rawOutput).metadata();if(meta.width!==2080||meta.height!==2288)throw Error('Wrong native dimensions '+r.sku);
  const final=exportsBySku.get(r.sku);if(aligned&&!final)continue;
  const reviewPath=aligned?final.finalPath:r.rawOutput;if(aligned&&hash(reviewPath)!==final.finalSha256)throw Error('Changed aligned '+r.sku);
  const thumb=r.sku+(aligned?'-aligned-review.jpg':'-review.jpg');await sharp(reviewPath).resize(520,572).jpeg({quality:94}).toFile(path.join(root,thumb));
  rows.push({...r,record,thumb,reviewPath});
 }
 for(const capacity of [...new Set(rows.map(r=>r.capacityMl))]){
  const rr=rows.filter(r=>r.capacityMl===capacity),cols=3,cw=440,ch=550,head=90,w=cols*cw,h=head+Math.ceil(rr.length/cols)*ch;
  for(const guided of [false,true]){
   const parts=[{input:Buffer.from(`<svg width="${w}" height="90"><text x="18" y="34" font-family="Arial" font-size="27">Elegant ${capacity} mL · ${rr.length} ${aligned?'aligned candidates':'regenerated candidates'}</text><text x="18" y="65" font-family="Arial" font-size="17">Sunburst 2.5 · native 2080 × 2288 · ${aligned?'measured shoulders + 91% base · review pending':guided?'target lines; measured registration pending':'appearance review; not published'}</text></svg>`),left:0,top:0}];
   for(const [i,r]of rr.entries()){
    const x=i%cols*cw,y=head+Math.floor(i/cols)*ch;
    parts.push({input:await sharp(r.reviewPath).resize(420,462).png().toBuffer(),left:x+10,top:y});
    const lines=guided?`<path d="M10 ${462*.91}H430" stroke="#168579"/><path d="M10 ${462*(91-r.target.shoulderPct)/100}H430" stroke="#b5852d" stroke-dasharray="5 4"/>`:'';
    parts.push({input:Buffer.from(`<svg width="440" height="550">${lines}<text x="10" y="486" font-family="Arial" font-size="18">${esc(r.catalog.color)} · ${esc(r.target.tier)}</text><text x="10" y="510" font-family="Arial" font-size="14">${esc(r.sku)}</text><text x="10" y="534" font-family="Arial" font-size="14">Target span ${r.target.shoulderPct}% · ${aligned?'measured alignment · ±13 px':'final lock check pending'}</text></svg>`),left:x,top:y});
   }
   await sharp({create:{width:w,height:h,channels:3,background:'#f5f3ef'}}).composite(parts).jpeg({quality:94}).toFile(path.join(root,`elegant-${capacity}ml-${aligned?'aligned':'generated'}-${guided?'guided':'clean'}.jpg`));
  }
 }
 fs.writeFileSync(path.join(root,aligned?'aligned-review-status.json':'review-status.json'),JSON.stringify({checkedAt:new Date().toISOString(),completed:rows.length,total:manifest.rows.length,status:aligned?'Measured whole-image alignment; user review pending':'Native renders; final geometry and appearance verification pending',rows:rows.map(r=>({sku:r.sku,sha256:r.record.outputSha256,size:[2080,2288],target:r.target}))},null,2)+'\n');
 fs.writeFileSync(path.join(root,aligned?'aligned.html':'index.html'),`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Elegant regeneration review</title><style>body{background:#f5f3ef;color:#282722;font:16px system-ui;margin:20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}article{border:1px solid #ddd;padding:12px}img{display:block;width:100%}.photo{position:relative}.base,.shoulder{position:absolute;left:0;right:0}.base{top:91%;border-top:1px solid #168579}.shoulder{border-top:1px dashed #b5852d}code{font-size:12px;overflow-wrap:anywhere}</style></head><body><h1>Elegant · ${rows.length} / 33 ${aligned?'aligned candidates':'native renders'}</h1><p>Sunburst 2.5 candidates. ${aligned?'Gold marks the measured shoulder; teal marks the 91% glass foot. Visual measurement uncertainty is at most 13 native pixels. Two 30 mL sprayers have approved nozzle color and await rendering after the background test.':'Gold and teal lines show targets, not completed measured locks.'} Original sources and native output bytes are preserved. Nothing is published.</p><div class="grid">${rows.map(r=>`<article><div class="photo"><img src="${r.thumb}" alt="${esc(r.sku)}"><i class="base"></i><i class="shoulder" style="top:${91-r.target.shoulderPct}%"></i></div><h3>${r.capacityMl} mL · ${esc(r.catalog.color)}</h3><code>${esc(r.sku)}</code><p>${esc(r.target.tier)} · ${r.target.shoulderPct}% span · 91% base</p></article>`).join('')}</div></body></html>`);
 console.log(JSON.stringify({completed:rows.length,total:manifest.rows.length}));
})().catch(e=>{console.error(e);process.exitCode=1});
